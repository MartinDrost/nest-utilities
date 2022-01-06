import { IPopulateOptions } from "fundering/distribution/interfaces/populate-options.interface";

export interface IHttpOptions {
  match?: Record<string, Record<string, any>>;
  sort?: string;

  /**
   * @deprecated offset is deprecated, use skip instead
   */
  offset?: string;
  skip?: string;
  limit?: string;
  select?: string;
  populate?: (string | IPopulateOptions)[];
  distinct?: string;
  random?: string;
}
