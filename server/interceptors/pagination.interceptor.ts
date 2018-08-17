import { ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

@Injectable()
export class PaginationInterceptor implements NestInterceptor {
  /**
   * Apply pagination to a request if either page or limit is defined as query param
   * and the response is an array.
   * @param context
   * @param stream$
   */
  intercept(
    context: ExecutionContext,
    stream$: Observable<any>
  ): Observable<any> {
    const queryParams = context.getArgByIndex(0).query;
    const offset = queryParams.offset;
    const limit = queryParams.limit;

    // slice the response if it complies to the pagination rules
    if (offset || limit) {
      return stream$.pipe(
        map(value => {
          const response = context.switchToHttp().getResponse();

          if (Array.isArray(value)) {
            const exposeHeaders = ["X-total-count"];
            const existingHeaders = (response.Headers || {})[
              "Access-Control-Expose-Headers"
            ];
            if (existingHeaders) {
              exposeHeaders.push(existingHeaders);
            }
            response.header(
              "Access-Control-Expose-Headers",
              exposeHeaders.join(", ")
            );
            response.header("X-total-count", value.length);
            value = value.splice(offset || 0, limit || value.length);
          }
          return value;
        })
      );
    }
    return stream$;
  }
}
