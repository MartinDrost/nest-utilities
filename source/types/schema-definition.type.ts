import { Schema, SchemaType, SchemaTypeOpts } from "mongoose";
import { IModel } from "../interfaces/model.interface";

export type SchemaDefinition<T> = {
  [key in keyof Omit<T, keyof IModel>]-?:
    | SchemaTypeOpts<any>
    | Schema
    | SchemaType;
};
