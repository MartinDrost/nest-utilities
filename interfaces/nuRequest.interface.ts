import { ExecutionContext } from "@nestjs/common";
import { Request } from "express";

export interface NURequest extends Request {
  context: ExecutionContext;
}
