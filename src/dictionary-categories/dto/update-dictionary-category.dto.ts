import { PartialType } from '@nestjs/mapped-types';
import { CreateDictionaryCategoryDto } from './create-dictionary-category.dto.js';

export class UpdateDictionaryCategoryDto extends PartialType(
  CreateDictionaryCategoryDto,
) {}
