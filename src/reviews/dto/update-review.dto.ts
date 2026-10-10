import { PartialType, PickType } from '@nestjs/mapped-types';
import { CreateReviewDto } from './create-review.dto.js';

// Only the text can change; a review can't be moved to another user or course
export class UpdateReviewDto extends PartialType(
  PickType(CreateReviewDto, ['comment'] as const),
) {}
