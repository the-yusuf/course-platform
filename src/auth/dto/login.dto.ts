import { IsNotEmpty, IsString } from 'class-validator';
import { Trim } from '../../common/trim.decorator.js';

export class LoginDto {
  @Trim()
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}
