import { ExecutionContext, Injectable } from "@nestjs/common";
import { NestInterceptor, CallHandler } from "@nestjs/common";

@Injectable()
export class ContextInterceptor implements NestInterceptor {
  /**
   * Add the context to the request data
   * @param context
   * @param next
   */
  intercept(
    context: ExecutionContext,
    next: CallHandler
  ): ReturnType<NestInterceptor["intercept"]> {
    const request = context.switchToHttp().getRequest();
    request.context = context;

    return next.handle();
  }
}
