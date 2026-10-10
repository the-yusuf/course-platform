import { IsNotEmpty, IsString, IsUUID } from 'class-validator';
import { Trim } from '../../common/trim.decorator.js';

// The author is always the logged-in user, never taken from the body
export class CreateReviewDto {
  @Trim()
  @IsString()
  @IsNotEmpty()
  comment: string;

  @IsUUID()
  course_id: string;
}
