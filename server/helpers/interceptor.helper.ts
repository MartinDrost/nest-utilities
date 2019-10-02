import { INestApplication } from "@nestjs/common";
import { HttpExceptionFilter } from "../filters";
import {
  ContextInterceptor,
  CsvInterceptor,
  FilterInterceptor,
  PaginationInterceptor,
  PickInterceptor,
  SearchInterceptor,
  SortInterceptor
} from "../interceptors";
/**
 * Enable all available interceptors
 * @param app
 */
export const useAllInterceptors = (
  app: INestApplication | any,
  showStacktraces = false
) => {
  app.useGlobalInterceptors(new CsvInterceptor());
  app.useGlobalInterceptors(new PaginationInterceptor());
  app.useGlobalInterceptors(new SortInterceptor());
  app.useGlobalInterceptors(new PickInterceptor());
  app.useGlobalInterceptors(new SearchInterceptor());
  app.useGlobalInterceptors(new FilterInterceptor());
  app.useGlobalInterceptors(new ContextInterceptor());

  app.useGlobalFilters(new HttpExceptionFilter(showStacktraces));
};
