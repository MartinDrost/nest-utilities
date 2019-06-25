import {
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  NestInterceptor,
  CallHandler
} from "@nestjs/common";
import { throwError } from "rxjs";
import { catchError } from "rxjs/operators";

@Injectable()
export class ExceptionInterceptor implements NestInterceptor {
  private options: { stack: boolean } = {
    stack: false
  };

  constructor(options: { stack?: boolean } = {}) {
    this.options = {
      ...this.options,
      ...options
    };
  }

  /**
   * Catch exceptions and default to a BAD_REQUEST HttpException if
   * none is defined.
   * @param context
   * @param next
   */
  intercept(
    context: ExecutionContext,
    next: CallHandler
  ): ReturnType<NestInterceptor["intercept"]> {
    return next.handle().pipe(
      catchError((err: Error) => {
        if (this.options.stack) {
          return throwError(
            err instanceof HttpException
              ? new HttpException(err.stack || "", err.getStatus())
              : new HttpException(err.stack || "", HttpStatus.BAD_REQUEST)
          );
        }

        return throwError(
          err instanceof HttpException
            ? new HttpException(err.getResponse(), err.getStatus())
            : new HttpException(err.message, HttpStatus.BAD_REQUEST)
        );
      })
    );
  }
}
