import { Transform } from 'class-transformer';

// Runs before validation, so @MinLength / @IsNotEmpty check the trimmed value
export const Trim = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));
