import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { IsPassword } from '../../common/validators.js';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  current_password: string;

  @IsPassword()
  new_password: string;
}
