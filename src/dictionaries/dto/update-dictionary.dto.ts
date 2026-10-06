import { PartialType } from '@nestjs/mapped-types';
import { CreateDictionaryDto } from './create-dicionary.dto.js';

export class UpdateDictionaryDto extends PartialType(CreateDictionaryDto) {}
