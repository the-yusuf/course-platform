import { LessonOutlineEntity } from '../../lessons/entities/lesson.entity.js';
import { ReviewViewEntity } from '../../reviews/entities/review.entity.js';

export class CourseEntity {
  id: string;
  title: string;
  description: string;
  /** Absolute URL of the course image */
  image: string | null;
  price_uzs: number;
  created_at: Date;
  updated_at: Date;
}

export class CourseListItemEntity extends CourseEntity {
  lessons_count: number;
  reviews_count: number;
}

export class CourseDetailEntity extends CourseEntity {
  /** In order; video links are only in GET /lessons/:id (enrollment needed) */
  lessons: LessonOutlineEntity[];
  reviews: ReviewViewEntity[];
}
