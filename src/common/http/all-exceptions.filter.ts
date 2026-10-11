import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { STATUS_CODES } from 'node:http';
import { DatabaseError } from 'pg';
import type { EnvironmentVariables } from '../../config/env.validation.js';
import { pgErrorToHttp } from '../../database/pg-error.mapper.js';
import type { ErrorEnvelope } from './envelope.js';

/** Errors from Express middleware such as body-parser (the http-errors package) */
interface HttpError extends Error {
  status: number;
  expose?: boolean;
}
const isHttpError = (err: unknown): err is HttpError =>
  err instanceof Error &&
  typeof (err as HttpError).status === 'number' &&
  (err as HttpError).status >= 400 &&
  (err as HttpError).status < 600;

/**
 * Every error leaves the API in the same shape:
 * { statusCode, message, error, data: null }
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionsHandler');
  private readonly production: boolean;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    this.production = config.get('NODE_ENV', { infer: true }) === 'production';
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request & { id?: string }>();
    const res = ctx.getResponse<Response>();

    const http = this.toHttpException(exception);
    const statusCode = http.getStatus();
    const response = http.getResponse();
    const { message, error } =
      typeof response === 'string'
        ? { message: response, error: undefined }
        : (response as { message?: string | string[]; error?: string });

    if (statusCode >= 500) {
      this.logger.error(
        `${req.method} ${req.originalUrl} (request ${req.id ?? '-'})`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }
    if (res.headersSent) return void res.end();

    const body: ErrorEnvelope = {
      statusCode,
      message: message ?? STATUS_CODES[statusCode] ?? 'Error',
      error: error ?? STATUS_CODES[statusCode] ?? 'Error',
      data: null,
    };
    res.status(statusCode).json(body);
  }

  private toHttpException(exception: unknown): HttpException {
    if (exception instanceof HttpException) return exception;
    if (exception instanceof DatabaseError) {
      const mapped = pgErrorToHttp(exception, this.production);
      if (mapped) return mapped;
    }
    if (isHttpError(exception)) {
      return new HttpException(
        exception.expose ? exception.message : STATUS_CODES[exception.status]!,
        exception.status,
      );
    }
    return new InternalServerErrorException();
  }
}
