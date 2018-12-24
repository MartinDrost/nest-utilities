import {
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  NestInterceptor
} from "@nestjs/common";
import { Observable, throwError } from "rxjs";
import { catchError } from "rxjs/operators";

@Injectable()
export class ExceptionInterceptor implements NestInterceptor {
  private options: { stack: boolean } = {
    stack: false
  };

  constructor(options: { stack: boolean }) {
    this.options = {
      ...this.options,
      ...options
    };
  }

  /**
   * Catch exceptions and default to a BAD_REQUEST HttpException if
   * none is defined.
   * @param context
   * @param stream$
   */
  intercept(
    context: ExecutionContext,
    stream$: Observable<any>
  ): Observable<any> {
    return stream$.pipe(
      catchError((err: Error) => {
        if (this.options.stack) {
          return throwError(
            err instanceof HttpException
              ? err.stack
              : new HttpException(err.stack, HttpStatus.BAD_REQUEST)
          );
        }

        return throwError(
          err instanceof HttpException
            ? err.message
            : new HttpException(err.message, HttpStatus.BAD_REQUEST)
        );
      })
    );
  }
}
