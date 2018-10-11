import { ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

@Injectable()
export class PaginationInterceptor implements NestInterceptor {
  /**
   * Apply pagination to a request if either page or limit is defined as query param
   * and the response is an array.
   * f.e: ..?offset=5&limit=10
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

    // return if the interceptor is not triggered
    if (
      [undefined, null].indexOf(offset) !== -1 &&
      [undefined, null].indexOf(limit) !== -1
    ) {
      return stream$;
    }

    // slice the response
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
}
