import { ExecutionContext, HttpException, HttpStatus, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable, throwError } from "rxjs";
import { catchError } from "rxjs/operators";

@Injectable()
export class ExceptionInterceptor implements NestInterceptor {
  /**
   * Catch exceptions and default to a BAD_REQUEST HttpException if
   * none is defined.
   * @param context
   * @param stream$
   */
  intercept(
    context: ExecutionContext,
    stream$: Observable<any>,
  ): Observable<any> {
    return stream$.pipe(
      catchError(err => {
        return throwError(
          err instanceof HttpException
            ? err
            : new HttpException(err.message, HttpStatus.BAD_REQUEST),
        );
      }),
    );
  }
}
