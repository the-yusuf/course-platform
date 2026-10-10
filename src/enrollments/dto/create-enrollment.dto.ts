import { IsUUID } from 'class-validator';

export class CreateEnrollmentDto {
  @IsUUID()
  user_id: string;

  @IsUUID()
  course_id: string;
}
