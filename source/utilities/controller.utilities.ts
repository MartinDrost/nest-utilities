import { Conditions, CrudService, IQueryOptions } from "fundering";
import { IPopulateOptions } from "fundering/distribution/interfaces/populate-options.interface";
import { customOperators } from "../constants/custom-operators";
import { IExpressQueryOptions } from "../interfaces/express-query-options.interface";
import { IHttpOptions } from "../interfaces/http-options.interface";
import { IQueryOptionsConfig } from "../interfaces/query-options-config.interface";

/**
 * Adds a method to the onBeforeCount hook which injects the total count
 * into the response object if available
 * @param service
 */
export const addCountHeaderHook = async (service: CrudService<any>) => {
  (service as any)["postCount"] = async (
    resultCount: number,
    options?: IExpressQueryOptions
  ) => {
    // append the total count header and expose it to the client
    options?.response?.header("X-total-count", resultCount.toString());
    options?.response?.header("Access-Control-Expose-Headers", [
      "X-total-count",
      (
        options?.response?.getHeader("Access-Control-Expose-Headers") || ""
      ).toString(),
    ]);
  };
};

/**
 * Cast query conditions to conditions worthy for the
 * aggregation pipeline.
 *
 * Filters out unsupported operators and forces a maximum field depth
 *
 * @param conditions
 * @param remainingDepth
 * @param wildcard
 */
const castQueryConditions = (conditions: Conditions, remainingDepth = 3) => {
  let castedConditions: Conditions = {};
  // move filter queries to the $and conditions
  for (const [field, value] of Object.entries(conditions || [])) {
    // omit keys which pass the remainingDepth
    const fieldDepth = !field.startsWith("$") ? field.split(".").length : 0;
    if (fieldDepth > remainingDepth) {
      continue;
    }

    // either:
    // 1. cast custom operators
    // 2. cast every item in an array
    // 3. use the string value
    // 4. cast the object value
    if (customOperators[field]) {
      castedConditions = {
        ...castedConditions,
        ...customOperators[field](value),
      };
    } else if (Array.isArray(value)) {
      castedConditions[field] = value.map((item) =>
        typeof item === "string"
          ? toPrimitive(decodeURIComponent(item))
          : castQueryConditions(item, remainingDepth - fieldDepth)
      );
    } else if (typeof value === "string") {
      castedConditions[field] = toPrimitive(decodeURIComponent(value));
    } else {
      castedConditions[field] = castQueryConditions(
        value,
        remainingDepth - fieldDepth
      );
    }
  }

  return castedConditions;
};

const enclosedRegex = /^{{.*}}$/;
const numberRegex = /^\d+(\.\d+)?$/;

/**
 * Parses a value to it's primitive type when enclosed in {{}}
 * @param value
 * @returns
 */
const toPrimitive = (value: string) => {
  if (enclosedRegex.test(value) === false) {
    return value;
  }

  // remove the {{}} from the string
  const strippedValue = value.slice(2, -2);

  // check if the value contains a valid number
  if (numberRegex.test(strippedValue)) {
    return +strippedValue;
  }

  // map the values to their written primitives otherwise
  switch (strippedValue) {
    case "null":
      return null;
    case "undefined":
      return undefined;
    case "true":
      return true;
    case "false":
      return false;
    default:
      return strippedValue;
  }
};

/**
 * Converts http query params to Mongoose options
 * @param query
 */
export const queryToOptions = (
  query: IHttpOptions,
  config?: IQueryOptionsConfig
): IQueryOptions => {
  const maxDepth = config?.maxDepth ?? 3;
  const populate =
    query.populate == undefined
      ? undefined
      : Array.isArray(query.populate)
      ? query.populate
      : [];

  const skip = query.skip || query.offset;
  const options: IQueryOptions = {
    match: castQueryConditions(query.match || {}, maxDepth),
    addFields: query.addFields,
    populate: limitPopulateOptionsDepth(populate, maxDepth),
    limit: query.limit ? +query.limit : undefined,
    skip: skip ? +skip : undefined,
    random: !["0", "false", undefined].includes(query.random),
    sort: Array.isArray(query.sort) ? query.sort : [],
    select: Array.isArray(query.select) ? query.select : [],
    distinct: query.distinct,
    custom: castQueryConditions(query.custom || {}, maxDepth),
  };

  return options;
};

/**
 * Limit the attempted population depth
 * @param populateOptions
 * @param remainingDepth
 */
const limitPopulateOptionsDepth = (
  populateOptions?: (string | IPopulateOptions)[],
  remainingDepth = 3
) => {
  return populateOptions?.map((option) => {
    if (typeof option !== "string") {
      if (option.match) {
        option.match = castQueryConditions(option.match, remainingDepth);
      }
      option.populate = limitPopulateOptionsDepth(
        option.populate,
        remainingDepth - 1
      ) as IPopulateOptions[];
    } else {
      const path = option.split(".");
      option = path
        .slice(0, path.length - Math.max(0, path.length - remainingDepth))
        .join(".");
    }

    return option;
  });
};
