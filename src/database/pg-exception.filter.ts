import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ConflictException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { DatabaseError } from 'pg';

// Safety net for Postgres errors the services don't handle themselves.
// DTO validation catches most bad input first; this keeps the rest from becoming a 500.
@Catch(DatabaseError)
export class PgExceptionFilter extends BaseExceptionFilter {
  catch(err: DatabaseError, host: ArgumentsHost) {
    const mapped = this.toHttp(err);
    super.catch(mapped ?? err, host);
  }

  private toHttp(err: DatabaseError): HttpException | undefined {
    switch (err.code) {
      case '23503': {
        // foreign_key_violation
        const missing = err.detail?.match(
          /Key \((.+?)\)=\((.*?)\) is not present/,
        );
        if (missing)
          return new NotFoundException(`${missing[1]} ${missing[2]} not found`);
        const table = err.detail?.match(/referenced from table "(.+?)"/)?.[1];
        return new ConflictException(
          `Record is still referenced${table ? ` by ${table}` : ''}`,
        );
      }
      case '23505': // unique_violation
        return new ConflictException('Record already exists');
      case '23502': // not_null_violation
        return new BadRequestException(
          `${err.column ?? 'value'} must not be null`,
        );
      case '23514': // check_violation
        return new BadRequestException(`Invalid value (${err.constraint})`);
      case '22P02': // invalid_text_representation, e.g. a non-UUID id
        return new BadRequestException('Invalid input syntax');
      default:
        return undefined;
    }
  }
}
