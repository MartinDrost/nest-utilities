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
  const _postCount = service.getHook("postCount");

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

    _postCount?.(resultCount, options);
  };
};

/**
 * Converts the filter and search query parameters to a Conditions object
 * @param query
 */
export const queryToConditions = (
  query: IHttpOptions,
  maxDepth = 3
): Conditions => {
  const conditions: Conditions = {};
  if (query.match) {
    conditions.$and = Object.entries(query.match ?? {}).map(([key, value]) =>
      castQueryConditions({ [key]: value }, maxDepth)
    );
  }
  if (query.search) {
    conditions.$or = Object.entries(query.search ?? {}).map(([key, value]) =>
      castQueryConditions({ [key]: value }, maxDepth, true)
    );
  }

  return conditions;
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
const castQueryConditions = (
  conditions: Conditions,
  remainingDepth = 3,
  wildcard = false
) => {
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
          ? decodeURIComponent(item)
          : castQueryConditions(item, remainingDepth - fieldDepth)
      );
    } else if (typeof value === "string") {
      if (!wildcard) {
        castedConditions[field] = value;
      }

      // wildcard for soon to be deprecated search query param
      if (wildcard) {
        const searchConditions: Conditions[] = [{ [field]: value }];
        // add "WHERE LIKE" search
        if (!field.startsWith("$") || ["$eq", "$ne"].includes(field)) {
          const regex = {
            // escape regular expression characters
            $regex: (decodeURIComponent(value) + "").replace(
              /[\\^$.*+?()[\]{}|]/g,
              "\\$&"
            ),
            $options: "i",
          };
          if (!field.startsWith("$") || field === "$eq") {
            searchConditions.push({ [field]: regex });
          } else {
            searchConditions.push({ [field]: { $not: regex } });
          }
        }

        castedConditions.$or = searchConditions;
      }
    } else {
      castedConditions[field] = castQueryConditions(
        value,
        remainingDepth - fieldDepth
      );
    }
  }

  return castedConditions;
};

/**
 * Converts http query params to Mongoose options
 * @param query
 */
export const queryToOptions = (
  query: IHttpOptions,
  config?: IQueryOptionsConfig
): IQueryOptions => {
  let { populate, limit, offset, sort, random, select, distinct } = query;
  const maxDepth = config?.maxDepth ?? 3;
  populate =
    populate == undefined ? undefined : Array.isArray(populate) ? populate : [];

  const options: IQueryOptions = {
    match: queryToConditions(query, maxDepth),
    populate: limitPopulateOptionsDepth(populate, maxDepth),
    limit: limit ? +limit : undefined,
    skip: offset ? +offset : undefined,
    random: !["0", "false", undefined].includes(random),
    sort: Array.isArray(sort) ? sort : [],
    select: Array.isArray(select) ? select : [],
    distinct,
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
