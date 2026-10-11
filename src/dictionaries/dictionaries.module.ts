import { Module } from '@nestjs/common';
import { DictionariesService } from './dictionaries.service.js';
import { EnrollmentsModule } from '../enrollments/enrollments.module.js';
import { DictionariesController } from './dictionaries.controller.js';

@Module({
  imports: [EnrollmentsModule],
  controllers: [DictionariesController],
  providers: [DictionariesService],
})
export class DictionariesModule {}
