import {
  ExecutionContext,
  Injectable,
  NestInterceptor,
  CallHandler
} from "@nestjs/common";
import _get from "lodash/get";
import { map } from "rxjs/operators";

@Injectable()
export class FilterInterceptor implements NestInterceptor {
  /**
   * Filter the response values based on queryParams.
   * f.e: ..?filter[key1]=match1&filter[key2.key3]=match2
   * @param context
   * @param next
   */
  intercept(
    context: ExecutionContext,
    next: CallHandler
  ): ReturnType<NestInterceptor["intercept"]> {
    const queryParams = context.getArgByIndex(0).query;
    const filter = queryParams.filter;

    // return if the interceptor is not triggered
    if ([undefined, null].indexOf(filter) !== -1) {
      return next.handle();
    }

    return next.handle().pipe(
      map(value => {
        if (Array.isArray(value)) {
          // set all filter values to lowercase
          for (const filterKey of Object.keys(filter)) {
            filter[filterKey] = filter[filterKey].toLowerCase();
          }

          // loop over the returned items
          for (let i = 0; i < value.length; i++) {
            const item = value[i];
            // check if the item matches all provided filters
            let valid = true;
            for (const filterKey of Object.keys(filter)) {
              const itemValue = _get(item, filterKey);
              if (
                [null, undefined].indexOf(itemValue) !== -1 ||
                itemValue
                  .toString()
                  .toLowerCase()
                  .indexOf(filter[filterKey]) === -1
              ) {
                valid = false;
                break;
              }
            }

            // remove the item if it does not conform the filter
            if (valid === false) {
              value.splice(i, 1);
              i--;
            }
          }
        }

        return value;
      })
    );
  }
}
