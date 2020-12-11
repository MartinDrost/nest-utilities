import {
  castableOperators,
  Conditions,
  CrudService,
  IQueryOptions,
} from 'fundering';
import { customOperators } from '../constants/custom-operators';
import { IExpressQueryOptions } from '../interfaces/express-query-options.interface';
import { IHttpOptions } from '../interfaces/http-options.interface';
import { IQueryOptionsConfig } from '../interfaces/query-options-config.interface';

/**
 * Adds a method to the onBeforeCount hook which injects the total count
 * into the response object if available
 * @param service
 */
export const addCountHeaderHook = async (service: CrudService<any>) => {
  const _postCount = service.getHook('postCount');

  (service as any)['postCount'] = async (
    resultCount: number,
    options?: IExpressQueryOptions,
  ) => {
    // append the total count header and expose it to the client
    options?.response?.header('X-total-count', resultCount.toString());
    options?.response?.header('Access-Control-Expose-Headers', [
      'X-total-count',
      (
        options?.response?.getHeader('Access-Control-Expose-Headers') || ''
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
  maxDepth = 3,
): Conditions => {
  const conditions: Conditions = { $and: [], $or: [] };

  // move filter queries to the $and conditions
  for (const [field, condition] of Object.entries(query.filter || [])) {
    // omit keys which pass the maxDepth
    if (field.split('.').length > maxDepth) {
      continue;
    }

    for (const [operator, value] of Object.entries(condition)) {
      // cast custom operators
      if (customOperators[operator]) {
        conditions.$and.push({
          [field]: customOperators[operator](value),
        });
      }

      // omit operators which aren't supported by the casting service
      if (!castableOperators.includes(operator)) {
        continue;
      }
      conditions.$and.push({
        [field]: {
          [operator]: Array.isArray(value)
            ? value.map(decodeURIComponent)
            : decodeURIComponent(value),
        },
      });
    }
  }

  // move search queries to the $or conditions
  for (const [field, condition] of Object.entries(query.search || [])) {
    for (const [operator, value] of Object.entries(condition)) {
      // cast custom operators
      if (customOperators[operator]) {
        conditions.$or.push({
          [field]: customOperators[operator](value),
        });
      }

      // omit operators which aren't supported by the casting service
      if (!castableOperators.includes(operator)) {
        continue;
      }

      conditions.$or.push({
        [field]: {
          [operator]: Array.isArray(value)
            ? value.map(decodeURIComponent)
            : decodeURIComponent(value),
        },
      });

      // add "WHERE LIKE" search
      if (['$eq', '$ne'].includes(operator)) {
        const regex = {
          // escape regular expression characters
          $regex: (decodeURIComponent(value) + '').replace(
            /[\\^$.*+?()[\]{}|]/g,
            '\\$&',
          ),
          $options: 'i',
        };
        if (operator === '$eq') {
          conditions.$or.push({ [field]: regex });
        } else {
          conditions.$or.push({ [field]: { $not: regex } });
        }
      }
    }
  }

  // remove empty $and and $or statements since they break the query
  for (const [key, value] of Object.entries(conditions)) {
    if (value.length === 0) {
      delete conditions[key];
    }
  }

  return conditions;
};

/**
 * Converts http query params to Mongoose options
 * @param query
 */
export const queryToOptions = (
  query: IHttpOptions,
  config?: IQueryOptionsConfig,
): IQueryOptions => {
  const { populate, limit, offset, sort, random, select, distinct } = query;
  const maxDepth = config?.maxDepth ?? 3;
  const populatePaths =
    populate == undefined ? undefined : Array.isArray(populate) ? populate : [];

  const options: IQueryOptions = {
    filter: queryToConditions(query, maxDepth),
    populate: populatePaths,
    limit: limit ? +limit : undefined,
    skip: offset ? +offset : undefined,
    random: !['0', 'false', undefined].includes(random),
    sort: Array.isArray(sort) ? sort : [],
    select: Array.isArray(select) ? select : [],
    distinct,
  };

  return options;
};
