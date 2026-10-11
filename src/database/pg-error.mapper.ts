import {
  BadRequestException,
  ConflictException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseError } from 'pg';

/**
 * Turns the Postgres errors that bad input can cause into 4xx responses.
 * DTO validation catches most bad input first; this is the safety net.
 * In production the messages are generic, so they don't leak schema details.
 * Returns undefined for anything else, which stays a 500.
 */
export function pgErrorToHttp(
  err: DatabaseError,
  production: boolean,
): HttpException | undefined {
  const detail = (devMessage: string, prodMessage: string) =>
    production ? prodMessage : devMessage;

  switch (err.code) {
    case '23503': {
      // foreign_key_violation
      const missing = err.detail?.match(
        /Key \((.+?)\)=\((.*?)\) is not present/,
      );
      if (missing)
        return new NotFoundException(
          detail(
            `${missing[1]} ${missing[2]} not found`,
            'Referenced record not found',
          ),
        );
      const table = err.detail?.match(/referenced from table "(.+?)"/)?.[1];
      return new ConflictException(
        detail(
          `Record is still referenced by ${table}`,
          'Record is still in use',
        ),
      );
    }
    case '23505': // unique_violation
      return new ConflictException('Record already exists');
    case '23502': // not_null_violation
      return new BadRequestException(
        detail(`${err.column} must not be null`, 'A required value is missing'),
      );
    case '23514': // check_violation
      return new BadRequestException(
        detail(`Invalid value (${err.constraint})`, 'Invalid value'),
      );
    case '22P02': // invalid_text_representation, e.g. a non-UUID id
      return new BadRequestException('Invalid input syntax');
    default:
      return undefined;
  }
}
