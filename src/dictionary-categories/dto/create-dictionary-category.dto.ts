import { IsNotEmpty, IsString } from 'class-validator';

export class CreateDictionaryCategoryDto {
  @IsString()
  @IsNotEmpty()
  name_uz: string;

  @IsString()
  @IsNotEmpty()
  name_ru: string;

  @IsString()
  @IsNotEmpty()
  name_en: string;
}
