export interface IHttpOptions {
  sort?: string;
  filter?: { [key: string]: string };
  offset?: string;
  limit?: string;
  pick?: string;
  search?: string;
  searchScope?: string;
  populate?: string;
  distinct?: string;
  random?: string;
}
