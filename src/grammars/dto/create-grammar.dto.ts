import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { Trim } from '../../common/trim.decorator.js';

export class CreateGrammarDto {
  @Trim()
  @IsString()
  @IsNotEmpty()
  title: string;

  @Trim()
  @IsString()
  @IsNotEmpty()
  description: string;

  @Trim()
  @IsString()
  @IsNotEmpty()
  example: string;

  @Trim()
  @IsString()
  @IsNotEmpty()
  example_uz: string;

  @Trim()
  @IsString()
  @IsNotEmpty()
  example_ru: string;

  @Trim()
  @IsString()
  @IsNotEmpty()
  example_en: string;

  // null unlinks the grammar from its lesson on update
  @IsOptional()
  @IsUUID()
  lesson_id?: string | null;
}
