import { INestApplication } from "@nestjs/common";
import { ContextInterceptor } from "../interceptors";

/**
 * Initiates basic functionality to use nest-utilities
 * @param app
 */
export const initNestUtilities = (app: INestApplication | any) => {
  app.useGlobalInterceptors(new ContextInterceptor());
};

/**
 * Validates if the given value is an object ID
 */
export const isObjectID = new RegExp("^[0-9a-fA-F]{24}$").test;
