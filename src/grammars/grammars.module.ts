import { Module } from '@nestjs/common';
import { GrammarsService } from './grammars.service.js';
import { EnrollmentsModule } from '../enrollments/enrollments.module.js';
import { GrammarsController } from './grammars.controller.js';

@Module({
  imports: [EnrollmentsModule],
  controllers: [GrammarsController],
  providers: [GrammarsService],
})
export class GrammarsModule {}
