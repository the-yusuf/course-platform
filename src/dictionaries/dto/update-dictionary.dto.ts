import { PartialType } from '@nestjs/swagger';
import { CreateDictionaryDto } from './create-dicionary.dto.js';

export class UpdateDictionaryDto extends PartialType(CreateDictionaryDto) {}
