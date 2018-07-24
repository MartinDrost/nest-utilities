import { ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import _get from "lodash/get";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

@Injectable()
export class SortInterceptor implements NestInterceptor {
  /**
   * Sort the response value if sort fields are defined as query param
   * and the response is an array.
   * @param context
   * @param stream$
   */
  intercept(
    context: ExecutionContext,
    stream$: Observable<any>
  ): Observable<any> {
    const queryParams = context.getArgByIndex(0).query;
    const sort = queryParams.sort;

    // sort the response if the requester defined any fields
    if (sort) {
      return stream$.pipe(
        map(value => {
          if (Array.isArray(value)) {
            const sortFields = sort.split(",");
            value = value.sort((a, b) => {
              // iterate all fields on which should be sorted
              for (let field of sortFields) {
                const desc = field.indexOf("-") === -1 ? 1 : -1;
                field = field.replace("-", "");
                const valueA = _get(a, field, -Infinity);
                const valueB = _get(b, field, -Infinity);

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
    return stream$;
  }
}
