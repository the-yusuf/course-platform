import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

const logger = new Logger('HTTP');
// accept a caller's id (e.g. from nginx) only if it's harmless to log
const SAFE_ID = /^[\w-]{1,64}$/;

/**
 * One log line per request (method, path, status, duration, user) and an
 * X-Request-Id that is echoed back and included in 5xx error logs.
 */
export function requestLogger(
  req: Request & { id?: string; user?: { id: string } },
  res: Response,
  next: NextFunction,
) {
  const incoming = req.headers['x-request-id'];
  const id =
    typeof incoming === 'string' && SAFE_ID.test(incoming)
      ? incoming
      : randomUUID();
  req.id = id;
  res.setHeader('X-Request-Id', id);

  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    const line = `${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(1)}ms user=${req.user?.id ?? '-'} id=${id}`;
    if (res.statusCode >= 500) logger.error(line);
    else if (res.statusCode >= 400) logger.warn(line);
    else logger.log(line);
  });
  next();
}
