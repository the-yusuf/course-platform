import { IsNotEmpty, IsString } from 'class-validator';

export class CreateStoryDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  title_uz: string;

  @IsString()
  @IsNotEmpty()
  title_ru: string;

  @IsString()
  @IsNotEmpty()
  title_en: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsString()
  @IsNotEmpty()
  content_uz: string;

  @IsString()
  @IsNotEmpty()
  content_ru: string;

  @IsString()
  @IsNotEmpty()
  content_en: string;

  @IsString()
  @IsNotEmpty()
  level: 'hsk1' | 'hsk2' | 'hsk3' | 'hsk4' | 'hsk5' | 'hsk6';
}
