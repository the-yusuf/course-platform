import { IsNotEmpty, IsString } from 'class-validator';
import { Trim } from '../../common/trim.decorator.js';

export class CreateDictionaryCategoryDto {
  @Trim()
  @IsString()
  @IsNotEmpty()
  name_uz: string;

  @Trim()
  @IsString()
  @IsNotEmpty()
  name_ru: string;

  @Trim()
  @IsString()
  @IsNotEmpty()
  name_en: string;
}
