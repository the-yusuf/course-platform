import { UserEntity } from '../../users/entities/user.entity.js';

export class TokenPairEntity {
  /** JWT, valid for 1 hour. Send as `Authorization: Bearer <token>` */
  access_token: string;
  /** Valid for 7 days; rotated on every refresh */
  refresh_token: string;
}

export class SessionEntity extends TokenPairEntity {
  user: UserEntity;
}
