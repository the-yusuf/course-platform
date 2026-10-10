import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { Trim } from '../../common/trim.decorator.js';

export class CreateLessonDto {
  @Trim()
  @IsString()
  @IsNotEmpty()
  title_uz: string;

  @Trim()
  @IsString()
  @IsNotEmpty()
  title_ru: string;

  @Trim()
  @IsString()
  @IsNotEmpty()
  title_en: string;

  // "" or null clears the video on update
  @IsOptional()
  @Trim()
  @IsString()
  video?: string | null;

  @IsUUID()
  course_id: string;
}
