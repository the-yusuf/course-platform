import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { Trim } from '../../common/trim.decorator.js';

export class CreateGrammarDto {
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  description: string;

  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  example: string;

  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  example_uz: string;

  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  example_ru: string;

  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  example_en: string;

  // null unlinks the grammar from its lesson on update
  @IsOptional()
  @IsUUID()
  lesson_id?: string | null;
}
