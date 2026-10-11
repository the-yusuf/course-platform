import {
  IsNotEmpty,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { Trim } from '../../common/trim.decorator.js';

export class CreateLessonDto {
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title_uz: string;

  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title_ru: string;

  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title_en: string;

  // optional; "" or null clears the video on update
  @ValidateIf(
    (_, value) => value !== undefined && value !== null && value !== '',
  )
  @Trim()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2048)
  video?: string | null;

  @IsUUID()
  course_id: string;
}
