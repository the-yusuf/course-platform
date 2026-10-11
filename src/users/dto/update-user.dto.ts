import { IsOptional } from 'class-validator';
import { IsNormalizedEmail, IsUsername } from '../../common/validators.js';

export class UpdateUserDto {
  @IsOptional()
  @IsUsername()
  username?: string;

  @IsOptional()
  @IsNormalizedEmail()
  email?: string;
}
