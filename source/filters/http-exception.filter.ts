import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from "@nestjs/common";
import { Response } from "express";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private showErrorDetails: boolean) {}

  catch(exception: Error, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // return the exception as is if we're dealing with a thrown http exception
    if (exception instanceof HttpException) {
      response.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    // else define it as an internal server error
    const json: { status: number; message: string | object; stack?: string } = {
      status: 500,
      message: "Internal server error",
    };

    // show the message and stack if we allow the handler to
    if (this.showErrorDetails) {
      json.message = exception.message;
      json.stack = exception.stack;
    }
    response.status(json.status).json(json);
  }
}
