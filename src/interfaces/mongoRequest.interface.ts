import { INURequest } from "./nuRequest.interface";
import { IMongoOptions } from "./mongoOptions.interface";
import { IMongoConditions } from "./mongoConditions.interface";
import { IMongoProjection } from "./mongoProjection.interface";

export interface IMongoRequest {
  request?: INURequest;
  conditions?: IMongoConditions;
  projection?: IMongoProjection;
  options?: IMongoOptions;
}
