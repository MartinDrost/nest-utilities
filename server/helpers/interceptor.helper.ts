import { NestApplication } from "@nestjs/core";
import {
  ContextInterceptor,
  FilterInterceptor,
  SearchInterceptor,
  PickInterceptor,
  SortInterceptor,
  PaginationInterceptor,
  CsvInterceptor,
  ExceptionInterceptor
} from "../interceptors";
import { INestApplication } from "@nestjs/common";

/**
 * Enable all available interceptors
 * @param app
 */
export const useAllInterceptors = (app: INestApplication) => {
  app.useGlobalInterceptors(new ContextInterceptor());
  app.useGlobalInterceptors(new FilterInterceptor());
  app.useGlobalInterceptors(new SearchInterceptor());
  app.useGlobalInterceptors(new PickInterceptor());
  app.useGlobalInterceptors(new SortInterceptor());
  app.useGlobalInterceptors(new PaginationInterceptor());
  app.useGlobalInterceptors(new CsvInterceptor());
  app.useGlobalInterceptors(new ExceptionInterceptor());
};
