import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { Request, Response } from "express";
import { IQueryOptionsConfig } from "../interfaces/query-options-config.interface";
import { queryToOptions } from "../utilities/controller.utilities";

export const QueryOptions = createParamDecorator<IQueryOptionsConfig>(
  (config: IQueryOptionsConfig, ctx: ExecutionContext) => {
    const request: Request = ctx.switchToHttp().getRequest();
    const response: Response = ctx.switchToHttp().getResponse();

    if (request.header["x-query-options"]) {
      return {
        ...queryToOptions(
          JSON.parse(request.header["x-query-options"]),
          config
        ),
        request,
        response,
      };
    }

    return {
      ...queryToOptions(request.query, config),
      request,
      response,
    };
  }
);
