export interface IWebSocketCrudParams {
  path: string[];
  query: { [name: string]: string };
  body: any;
}
