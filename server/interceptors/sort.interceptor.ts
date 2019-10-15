import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor
} from "@nestjs/common";
import _get from "lodash/get";
import { map } from "rxjs/operators";

@Injectable()
export class SortInterceptor implements NestInterceptor {
  /**
   * Sort the response value if sort fields are defined as query param
   * and the response is an array.
   * f.e: ..?sort=key1,-key2.key3
   * @param context
   * @param next
   */
  intercept(
    context: ExecutionContext,
    next: CallHandler
  ): ReturnType<NestInterceptor["intercept"]> {
    const queryParams = context.getArgByIndex(0).query;
    const sort = queryParams.sort;

    // return if the interceptor is not triggered
    if ([undefined, null].indexOf(sort) !== -1) {
      return next.handle();
    }

    return next.handle().pipe(
      map(value => {
        if (Array.isArray(value)) {
          const sortFields: string[] = sort.split(",");
          value = value.sort((a, b) => {
            // iterate all fields on which should be sorted
            for (let field of sortFields) {
              // determine whether to sort asc/desc and cleanse the field
              const startWithHyphen = field.startsWith("-");
              const desc = startWithHyphen ? -1 : 1;
              if (startWithHyphen) {
                field = field.replace("-", "");
              }

              let valueA = _get(a, field, -Infinity);
              let valueB = _get(b, field, -Infinity);

              // change undefined strings to empty ones so they get sorted correctly
              if (typeof valueA === "string" && valueB === -Infinity) {
                valueB = "";
              }
              if (typeof valueB === "string" && valueA === -Infinity) {
                valueA = "";
              }

              // set to lowercase if applicable
              if (typeof valueA === "string" && typeof valueB === "string") {
                valueA = valueA.toLowerCase();
                valueB = valueB.toLowerCase();
              }

              // return a position change if the fields differ
              if (valueA !== valueB) {
                return (valueA > valueB ? 1 : -1) * desc;
              }
            }

            return 0; // reside in the same place if both items are equal
          });
        }

        return value;
      })
    );
  }
}
