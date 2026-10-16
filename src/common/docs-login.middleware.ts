import type { NextFunction, Request, Response } from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { ErrorEnvelope } from './http/envelope.js';

const sha256 = (text: string) => createHash('sha256').update(text).digest();

/**
 * A browser login (HTTP Basic auth) in front of Swagger's pages: the browser
 * asks for the username and password once and remembers them until it closes.
 */
export function docsLogin(username: string, password: string) {
  const expected = sha256(`${username}:${password}`);

  return (req: Request, res: Response, next: NextFunction) => {
    const [scheme, encoded] = req.headers.authorization?.split(' ') ?? [];
    const given =
      scheme?.toLowerCase() === 'basic' && encoded
        ? Buffer.from(encoded, 'base64').toString()
        : '';
    // equal-length hashes, so the time taken says nothing about how close a guess was
    if (timingSafeEqual(sha256(given), expected)) return next();

    res.setHeader('WWW-Authenticate', 'Basic realm="API docs", charset="UTF-8"');
    const body: ErrorEnvelope = {
      statusCode: 401,
      message: 'Log in to see the API docs',
      error: 'Unauthorized',
      data: null,
    };
    res.status(401).json(body);
  };
}
