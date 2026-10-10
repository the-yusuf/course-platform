import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { Trim } from '../../common/trim.decorator.js';

export class CreateDictionaryDto {
  @Trim()
  @IsString()
  @IsNotEmpty()
  word_uz: string;

  @Trim()
  @IsString()
  @IsNotEmpty()
  word_ru: string;

  @Trim()
  @IsString()
  @IsNotEmpty()
  word_en: string;

  @Trim()
  @IsString()
  @IsNotEmpty()
  word_zh: string;

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

  @Trim()
  @IsString()
  @IsNotEmpty()
  example_zh: string;

  @Trim()
  @IsString()
  @IsNotEmpty()
  pronunciation: string;

  @Trim()
  @IsString()
  @IsNotEmpty()
  example_pronunciation: string;

  // null unlinks the word from its lesson on update
  @IsOptional()
  @IsUUID()
  lesson_id?: string | null;

  @IsUUID()
  category_id: string;
}
