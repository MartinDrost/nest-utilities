import {
  ExecutionContext,
  Injectable,
  NestInterceptor,
  CallHandler
} from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import _pick from "lodash/pick";
import { isString, isNumber, isObject } from "util";

@Injectable()
export class SearchInterceptor implements NestInterceptor {
  /**
   * Search an array of object for ones containing the given query.
   * f.e.: ..user?search=cat&searchScope=firstName,lastName,address
   * @param context
   * @param next
   */
  intercept(
    context: ExecutionContext,
    next: CallHandler
  ): ReturnType<NestInterceptor["intercept"]> {
    const queryParams = context.getArgByIndex(0).query;
    const { search, searchScope } = queryParams;

    // manipulate the return data if the search parameter is given
    if (search) {
      return next.handle().pipe(
        map(value => {
          const attributes = searchScope ? searchScope.split(",") : [];
          if (Array.isArray(value)) {
            return value.filter(item =>
              this.deepSearch(item, search.toLowerCase(), attributes)
            );
          }
          return value;
        })
      );
    }
    return next.handle();
  }

  /**
   * Searches an object for values concurrent to the query
   * @param item
   * @param query
   * @param attributes
   */
  private deepSearch(
    item: object,
    query: string,
    attributes: string[] = []
  ): boolean {
    // get all nested attributes if none are given
    if (attributes.length === 0) {
      attributes = this.getNestedAttributes(item);
    }

    // check if the attributes contain nested targets
    const attributeSet = new Set();
    const nestedAttributes: { [attribute: string]: string[] } = {};
    for (const attribute of attributes) {
      if (attribute.includes(".")) {
        const nested = attribute.split(".");
        const key = nested.shift() as string;

        nestedAttributes[key] = nestedAttributes[key] || [];
        nestedAttributes[key].push(nested.join("."));
        attributeSet.add(key);
      } else {
        attributeSet.add(attribute);
      }
    }

    // search the nested attributes
    for (const key of Object.keys(nestedAttributes)) {
      if (
        ![undefined, null].includes(item[key]) &&
        this.deepSearch(item[key], query, nestedAttributes[key])
      ) {
        return true;
      }
    }

    // search the attributes of the current layer
    for (const attribute of Array.from(attributeSet)) {
      let values: any[] = item[attribute];
      if (!Array.isArray(values)) {
        values = [item[attribute]];
      }

      // check if any of the values contain the query
      const accepted = values.some(value => {
        // only check string and number values
        if (!isString(value) && !isNumber(value)) {
          return false;
        }

        // check if the value includes the query
        return value
          .toString()
          .toLowerCase()
          .includes(query);
      });

      if (accepted) {
        return true;
      }
    }

    // refuse the object if no applicable value has been found
    return false;
  }

  /**
   * Returns an array of all keys up to 2 layers deep
   * @param item
   */
  private getNestedAttributes(item: object): string[] {
    const attributes: string[] = [];
    for (const key of Object.keys(item)) {
      attributes.push(key);

      if (isObject(item[key]) && !Array.isArray(item[key])) {
        for (const nestedKey of this.getNestedAttributes(item[key])) {
          attributes.push([key, nestedKey].join("."));
        }
      }
    }

    return attributes;
  }
}
