import { ExecutionContext } from "@nestjs/common";
import { Request } from "express";

export interface INuRequest extends Request {
  context: ExecutionContext;
}
