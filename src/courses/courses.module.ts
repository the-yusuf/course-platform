import { Module } from '@nestjs/common';
import { CoursesService } from './courses.service.js';
import { CoursesController } from './courses.controller.js';
import { ReviewsModule } from '../reviews/reviews.module.js';

@Module({
  imports: [ReviewsModule],
  controllers: [CoursesController],
  providers: [CoursesService],
})
export class CoursesModule {}
