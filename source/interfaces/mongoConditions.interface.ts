export type IMongoConditions<Model = any> =
  | {
      [key in keyof Model]: any;
    }
  | { [key: string]: any };
