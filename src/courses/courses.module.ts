import { Module } from '@nestjs/common';
import { CoursesService } from './courses.service.js';
import { CoursesController } from './courses.controller.js';
import { ReviewsModule } from '../reviews/reviews.module.js';
import { LessonsModule } from '../lessons/lessons.module.js';

@Module({
  imports: [ReviewsModule, LessonsModule],
  controllers: [CoursesController],
  providers: [CoursesService],
})
export class CoursesModule {}
