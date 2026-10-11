import {
  CallHandler,
  ExecutionContext,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Response } from 'express';
import { map, type Observable } from 'rxjs';
import { Paginated, type SuccessEnvelope } from './envelope.js';

/**
 * Wraps every successful response as { statusCode, message, data } and adds
 * `meta` for paginated lists. 204 responses stay empty.
 */
@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<SuccessEnvelope<unknown> | undefined> {
    const res = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((result: unknown) => {
        // Nest sets the status (e.g. 201, @HttpCode) before interceptors run
        const statusCode = res.statusCode;
        if (statusCode === HttpStatus.NO_CONTENT) return undefined;
        if (result instanceof Paginated) {
          return {
            statusCode,
            message: 'Success',
            data: result.items,
            meta: result.meta,
          };
        }
        return { statusCode, message: 'Success', data: result ?? null };
      }),
    );
  }
}
