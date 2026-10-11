import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export const USERNAME_PATTERN = /^[a-z0-9_.]{3,32}$/;

const normalize = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

/** Trimmed + lowercased, so "Alice" and "alice" are the same account */
export const IsUsername = () =>
  applyDecorators(
    Transform(normalize),
    IsString(),
    Matches(USERNAME_PATTERN, {
      message:
        'username must be 3-32 characters of lowercase letters, digits, "_" or "."',
    }),
  );

export const IsNormalizedEmail = () =>
  applyDecorators(Transform(normalize), IsEmail(), MaxLength(254));

// The upper bound keeps argon2 from hashing megabytes of input
export const IsPassword = () =>
  applyDecorators(IsString(), MinLength(8), MaxLength(128));
