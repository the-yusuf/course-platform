import { PartialType } from '@nestjs/swagger';
import { CreateGrammarDto } from './create-grammar.dto.js';

export class UpdateGrammarDto extends PartialType(CreateGrammarDto) {}
