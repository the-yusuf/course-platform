import { PartialType } from '@nestjs/swagger';
import { CreateDictionaryCategoryDto } from './create-dictionary-category.dto.js';

export class UpdateDictionaryCategoryDto extends PartialType(
  CreateDictionaryCategoryDto,
) {}
