import { Request, Response } from 'express';
import { IQueryOptions } from 'fundering';

export interface IExpressQueryOptions extends IQueryOptions {
  request?: Request;
  response?: Response;
}
