import { IMongoConditions } from "./mongoConditions.interface";
import { IMongoOptions } from "./mongoOptions.interface";
import { IMongoProjection } from "./mongoProjection.interface";
import { INURequest } from "./nuRequest.interface";

export interface IMongoRequest {
  request?: INURequest;
  conditions?: IMongoConditions;
  projection?: IMongoProjection;
  options?: IMongoOptions;
  populate?: string[];
}
