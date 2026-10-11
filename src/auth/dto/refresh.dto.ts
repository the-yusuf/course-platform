import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RefreshDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200) // "<uuid>.<43 base64url chars>"
  refresh_token: string;
}
