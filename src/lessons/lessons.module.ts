import { Module } from '@nestjs/common';
import { LessonsService } from './lessons.service.js';
import { LessonsController } from './lessons.controller.js';
import { EnrollmentsModule } from '../enrollments/enrollments.module.js';

@Module({
  imports: [EnrollmentsModule],
  controllers: [LessonsController],
  providers: [LessonsService],
})
export class LessonsModule {}
