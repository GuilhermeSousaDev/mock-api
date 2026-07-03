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

    // Only HttpExceptions were written for the client — anything else (Stripe
    // SDK errors, Prisma errors, body-parser, ...) may carry a 4xx status yet
    // still describe internals, so it gets a generic message. Normalise to a
    // plain string so clients never receive nested error objects.
    const message = this.toClientMessage(exception, status);

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  private toClientMessage(exception: unknown, status: number): string {
    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      if (typeof body === 'string') return body;
      const inner = (body as { message?: unknown }).message;
      if (typeof inner === 'string') return inner;
      // class-validator reports an array of constraint messages.
      if (Array.isArray(inner)) return inner.join('; ');
      return exception.message;
    }
    return status < HttpStatus.INTERNAL_SERVER_ERROR
      ? 'Bad request'
      : 'Internal server error';
  }
}
