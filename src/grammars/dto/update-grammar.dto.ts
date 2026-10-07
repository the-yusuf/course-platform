import { PartialType } from '@nestjs/mapped-types';
import { CreateGrammarDto } from './create-grammar.dto.js';

export class UpdateGrammarDto extends PartialType(CreateGrammarDto) {}
