import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateLessonDto {
  @IsString()
  @IsNotEmpty()
  title_uz: string;

  @IsString()
  @IsNotEmpty()
  title_ru: string;

  @IsString()
  @IsNotEmpty()
  title_en: string;

  @IsOptional()
  @IsString()
  video?: string;

  @IsString()
  @IsNotEmpty()
  course_id: string;
}
