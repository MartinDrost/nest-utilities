import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  InternalServerErrorException
} from "@nestjs/common";
import { Response } from "express";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly showStackTrace = false) {}

  catch(exception: any, host: ArgumentsHost) {
    const response: Response = host.switchToHttp().getResponse();

    let httpException: HttpException = exception;
    if (!httpException.getStatus) {
      httpException = new InternalServerErrorException(
        this.showStackTrace ? exception.stack : exception.message
      );
    }

    response.status(httpException.getStatus()).json(httpException.message);
  }
}
