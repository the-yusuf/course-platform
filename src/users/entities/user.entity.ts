export class UserEntity {
  id: string;
  username: string;
  email: string;
  /** Absolute URL of the avatar image */
  avatar: string | null;
  role: 'student' | 'admin';
  created_at: Date;
  updated_at: Date;
}
