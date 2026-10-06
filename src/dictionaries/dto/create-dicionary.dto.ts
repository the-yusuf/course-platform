import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateDictionaryDto {
  @IsString()
  @IsNotEmpty()
  word_uz: string;

  @IsString()
  @IsNotEmpty()
  word_ru: string;

  @IsString()
  @IsNotEmpty()
  word_en: string;

  @IsString()
  @IsNotEmpty()
  word_zh: string;

  @IsString()
  @IsNotEmpty()
  example_uz: string;

  @IsString()
  @IsNotEmpty()
  example_ru: string;

  @IsString()
  @IsNotEmpty()
  example_en: string;

  @IsString()
  @IsNotEmpty()
  example_zh: string;

  @IsString()
  @IsNotEmpty()
  pronunciation: string;

  @IsString()
  @IsNotEmpty()
  example_pronunciation: string;

  @IsOptional()
  @IsString()
  lesson_id?: string;

  @IsString()
  @IsNotEmpty()
  category_id: string;
}
