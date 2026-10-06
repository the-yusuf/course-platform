import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class UpdateUserPasswordDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  current_password: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  new_password: string;
}
