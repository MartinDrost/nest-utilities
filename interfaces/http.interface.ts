export interface IHttp {
  get: <T>(query: string) => Promise<T>;
  post: <T>(query: string, data: any) => Promise<T>;
  put: <T>(query: string, data: any) => Promise<T>;
  delete: <T>(query: string) => Promise<T>;
}
