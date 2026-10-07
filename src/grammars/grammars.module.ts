import { Module } from '@nestjs/common';
import { GrammarsService } from './grammars.service.js';
import { GrammarsController } from './grammars.controller.js';

@Module({
  controllers: [GrammarsController],
  providers: [GrammarsService],
})
export class GrammarsModule {}
