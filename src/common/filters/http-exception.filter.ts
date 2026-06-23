import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Some non-HttpException errors still carry an HTTP status — most notably
    // body-parser's PayloadTooLargeError (413) when an upload exceeds the limit.
    // Honor it so the client sees the real cause instead of a generic 500.
    const carriedStatus =
      exception instanceof HttpException
        ? exception.getStatus()
        : typeof (exception as { status?: unknown })?.status === 'number'
          ? (exception as { status: number }).status
          : typeof (exception as { statusCode?: unknown })?.statusCode === 'number'
            ? (exception as { statusCode: number }).statusCode
            : HttpStatus.INTERNAL_SERVER_ERROR;

    const status = carriedStatus;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : // Only expose the message for client errors (4xx); never leak 5xx internals.
          status < HttpStatus.INTERNAL_SERVER_ERROR &&
            exception instanceof Error
          ? exception.message
          : 'Internal server error';

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
