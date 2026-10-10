import { IsIn, IsNotEmpty, IsString } from 'class-validator';
import { Trim } from '../../common/trim.decorator.js';

// Must match the stories_level_check constraint in the initial migration
export const STORY_LEVELS = [
  'hsk1',
  'hsk2',
  'hsk3',
  'hsk4',
  'hsk5',
  'hsk6',
] as const;
export type StoryLevel = (typeof STORY_LEVELS)[number];

export class CreateStoryDto {
  @Trim()
  @IsString()
  @IsNotEmpty()
  title: string;

  @Trim()
  @IsString()
  @IsNotEmpty()
  title_uz: string;

  @Trim()
  @IsString()
  @IsNotEmpty()
  title_ru: string;

  @Trim()
  @IsString()
  @IsNotEmpty()
  title_en: string;

  @Trim()
  @IsString()
  @IsNotEmpty()
  content: string;

  @Trim()
  @IsString()
  @IsNotEmpty()
  content_uz: string;

  @Trim()
  @IsString()
  @IsNotEmpty()
  content_ru: string;

  @Trim()
  @IsString()
  @IsNotEmpty()
  content_en: string;

  @IsIn(STORY_LEVELS)
  level: StoryLevel;
}
