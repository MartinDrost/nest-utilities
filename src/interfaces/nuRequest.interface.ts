import { ExecutionContext } from "@nestjs/common";
import { Request } from "express";

export interface INURequest extends Request {
  context: ExecutionContext;
}
