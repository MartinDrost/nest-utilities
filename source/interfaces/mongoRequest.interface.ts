import { IMongoConditions } from "./mongoConditions.interface";
import { IMongoOptions } from "./mongoOptions.interface";
import { INURequest } from "./nuRequest.interface";

export interface IMongoRequest {
  request?: INURequest;
  conditions?: IMongoConditions;
  options?: IMongoOptions;
  populate?: string[];
}
