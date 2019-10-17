import { INestApplication } from "@nestjs/common";
import { ContextInterceptor } from "../interceptors";

export const initNestUtilities = (app: INestApplication | any) => {
  app.useGlobalInterceptors(new ContextInterceptor());
};
