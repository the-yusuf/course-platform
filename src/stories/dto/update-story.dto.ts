import { PartialType } from '@nestjs/swagger';
import { CreateStoryDto } from './create-story.dto.js';

export class UpdateStoryDto extends PartialType(CreateStoryDto) {}
