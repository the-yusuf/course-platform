import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Trim } from '../../common/trim.decorator.js';

export class CreateDictionaryCategoryDto {
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name_uz: string;

  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name_ru: string;

  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name_en: string;
}
