import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateGrammarDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsNotEmpty()
  example: string;

  @IsString()
  @IsNotEmpty()
  example_uz: string;

  @IsString()
  @IsNotEmpty()
  example_ru: string;

  @IsString()
  @IsNotEmpty()
  example_en: string;

  @IsOptional()
  @IsString()
  lesson_id?: string;
}
