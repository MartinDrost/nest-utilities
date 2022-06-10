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

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus?.() ?? 500;
    const json: { status: number; message: string; stack?: string } = {
      status,
      message: exception.message,
    };

    // hide internal server error messages when disabled
    if (status === 500 && this.showErrorDetails === false) {
      json.message = "Internal server error";
    }

    // add stack trace when enabled
    if (exception.stack && this.showErrorDetails) {
      json.stack = exception.stack;
    }

    response.status(status).json(json);
  }
}
