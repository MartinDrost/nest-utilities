import { ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import _get from "lodash/get";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

@Injectable()
export class SortInterceptor implements NestInterceptor {
  /**
   * Sort the response value if sort fields are defined as query param
   * and the response is an array.
   * f.e: ..?sort=key1,-key2.key3
   * @param context
   * @param stream$
   */
  intercept(
    context: ExecutionContext,
    stream$: Observable<any>
  ): Observable<any> {
    const queryParams = context.getArgByIndex(0).query;
    const sort = queryParams.sort;

    // return if the interceptor is not triggered
    if ([undefined, null].indexOf(sort) !== -1) {
      return stream$;
    }

    return stream$.pipe(
      map(value => {
        if (Array.isArray(value)) {
          const sortFields = sort.split(",");
          value = value.sort((a, b) => {
            // iterate all fields on which should be sorted
            for (let field of sortFields) {
              const desc = field.indexOf("-") === -1 ? 1 : -1;
              field = field.replace("-", "");
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
