import {
  ExecutionContext,
  Injectable,
  NestInterceptor,
  CallHandler
} from "@nestjs/common";
import _get from "lodash/get";
import { map } from "rxjs/operators";
import { IHttpOptions } from "../interfaces";
import { FilterInterceptor } from "./filter.interceptor";
import { PaginationInterceptor } from "./pagination.interceptor";
import { SearchInterceptor } from "./search.interceptor";
import { SortInterceptor } from "./sort.interceptor";
import { PickInterceptor } from "./pick.interceptor";

@Injectable()
export class QueryInterceptor implements NestInterceptor {
  /**
   * Implements all query interceptors through one call
   * @param context
   * @param next
   */
  intercept(
    context: ExecutionContext,
    next: CallHandler
  ): ReturnType<NestInterceptor["intercept"]> {
    const queryParams: IHttpOptions = context.getArgByIndex(0).query;

    // only add the interceptors if query params have been defined
    if (Object.keys(queryParams).length) {
      new FilterInterceptor().intercept(context, next);
      new SearchInterceptor().intercept(context, next);
      new SortInterceptor().intercept(context, next);
      new PaginationInterceptor().intercept(context, next);
      new PickInterceptor().intercept(context, next);
    }

    return next.handle();
  }
}
