import { IsPassword } from '../../common/validators.js';

// Admin reset: no current password needed (the admin doesn't know it)
export class UpdateUserPasswordDto {
  @IsPassword()
  new_password: string;
}
