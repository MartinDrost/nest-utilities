import { ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable } from "rxjs";

@Injectable()
export class ContextInterceptor implements NestInterceptor {
  /**
   * Add the context to the request data
   * @param context
   * @param stream$
   */
  intercept(
    context: ExecutionContext,
    stream$: Observable<any>
  ): Observable<any> {
    const request = context.switchToHttp().getRequest();
    request.context = context;

    return stream$;
  }
}
