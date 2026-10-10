import { IsEmail, IsString, MinLength } from 'class-validator';
import { Trim } from '../../common/trim.decorator.js';

export class CreateUserDto {
  @Trim()
  @IsString()
  @MinLength(3)
  username: string;

  @Trim()
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;
}
