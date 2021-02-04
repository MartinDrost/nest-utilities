import { IPopulateOptions } from "fundering/distribution/interfaces/populate-options.interface";

export interface IHttpOptions {
  filter?: Record<string, Record<string, any>>;
  search?: Record<string, Record<string, any>>;
  sort?: string;
  offset?: string;
  limit?: string;
  select?: string;
  populate?: (string | IPopulateOptions)[];
  distinct?: string;
  random?: string;
}
