import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { Trim } from '../../common/trim.decorator.js';

export class CreateDictionaryDto {
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  word_uz: string;

  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  word_ru: string;

  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  word_en: string;

  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  word_zh: string;

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

  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  example_zh: string;

  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  pronunciation: string;

  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  example_pronunciation: string;

  // null unlinks the word from its lesson on update
  @IsOptional()
  @IsUUID()
  lesson_id?: string | null;

  @IsUUID()
  category_id: string;
}
