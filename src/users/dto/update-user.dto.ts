import { IsString, MinLength, IsEmail, IsOptional } from 'class-validator';
import { Trim } from '../../common/trim.decorator.js';

export class UpdateUserDto {
  @IsOptional()
  @Trim()
  @IsString()
  @MinLength(3)
  username?: string;

  @IsOptional()
  @Trim()
  @IsEmail()
  email?: string;
}
