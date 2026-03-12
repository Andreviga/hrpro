import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Global exception filter that normalises all HTTP error responses to:
 *   { statusCode, error, message, code?, details?, path, timestamp }
 *
 * Exceptions thrown as ConflictException({ statusCode, error, message, code, details })
 * keep their structured body. Plain string exceptions like NotFoundException('msg')
 * are converted to the same format automatically.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode: number;
    let body: Record<string, unknown>;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const raw = exception.getResponse();

      if (typeof raw === 'string') {
        body = {
          statusCode,
          error: deriveErrorLabel(statusCode),
          message: raw
        };
      } else if (typeof raw === 'object' && raw !== null) {
        const rawObj = raw as Record<string, unknown>;
        body = {
          statusCode: rawObj.statusCode ?? statusCode,
          error: rawObj.error ?? deriveErrorLabel(statusCode),
          message: rawObj.message ?? exception.message
        };
        if (rawObj.code !== undefined) body.code = rawObj.code;
        if (rawObj.details !== undefined) body.details = rawObj.details;
      } else {
        body = { statusCode, error: deriveErrorLabel(statusCode), message: exception.message };
      }
    } else {
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      const msg = exception instanceof Error ? exception.message : 'Internal server error';
      this.logger.error(
        `Unhandled exception [${request.method} ${request.url}]: ${msg}`,
        exception instanceof Error ? exception.stack : undefined
      );
      body = {
        statusCode: 500,
        error: 'Internal Server Error',
        message:
          process.env.NODE_ENV === 'production' ? 'Internal server error' : msg
      };
    }

    response.status(statusCode).json({
      ...body,
      path: request.url,
      timestamp: new Date().toISOString()
    });
  }
}

function deriveErrorLabel(status: number): string {
  const map: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    409: 'Conflict',
    422: 'Unprocessable Entity',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    503: 'Service Unavailable'
  };
  return map[status] ?? 'Error';
}
