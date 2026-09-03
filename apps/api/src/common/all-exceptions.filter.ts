import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { API_ERROR_CODES, type ApiErrorBody } from '@okapi/shared';
import type { Request, Response } from 'express';

const STATUS_TO_CODE: Record<number, string> = {
  400: API_ERROR_CODES.VALIDATION,
  401: API_ERROR_CODES.UNAUTHENTICATED,
  403: API_ERROR_CODES.FORBIDDEN,
  404: API_ERROR_CODES.NOT_FOUND,
  409: API_ERROR_CODES.CONFLICT,
  429: API_ERROR_CODES.RATE_LIMITED,
};

/** Normalise toutes les erreurs vers l'enveloppe `{ error: { code, message, details, requestId } }`. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const requestId = req.requestId;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: ApiErrorBody['error'] = {
      code: 'INTERNAL_ERROR',
      message: 'Erreur interne',
    };

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const payload = exception.getResponse();
      if (typeof payload === 'object' && payload !== null && 'error' in payload) {
        body = (payload as ApiErrorBody).error;
      } else if (typeof payload === 'object' && payload !== null) {
        const p = payload as { message?: unknown };
        body = {
          code: STATUS_TO_CODE[status] ?? 'HTTP_ERROR',
          message: Array.isArray(p.message)
            ? p.message.join(', ')
            : String(p.message ?? exception.message),
        };
      } else {
        body = { code: STATUS_TO_CODE[status] ?? 'HTTP_ERROR', message: String(payload) };
      }
    } else if (exception instanceof Error) {
      this.logger.error(`${exception.name}: ${exception.message}`, exception.stack);
    }

    if (status >= 500) {
      this.logger.error(
        `${req.method} ${req.url} -> ${status} [${requestId ?? '-'}]`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    res.status(status).json({ error: { ...body, requestId } } satisfies ApiErrorBody);
  }
}
