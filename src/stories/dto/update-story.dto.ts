import { PartialType } from '@nestjs/mapped-types';
import { CreateStoryDto } from './create-story.dto.js';

export class UpdateStoryDto extends PartialType(CreateStoryDto) {}
