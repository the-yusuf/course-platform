import {
  IsNormalizedEmail,
  IsPassword,
  IsUsername,
} from '../../common/validators.js';

export class CreateUserDto {
  @IsUsername()
  username: string;

  @IsNormalizedEmail()
  email: string;

  @IsPassword()
  password: string;
}
