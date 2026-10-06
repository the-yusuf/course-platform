import { Module } from '@nestjs/common';
import { DictionariesService } from './dictionaries.service.js';
import { DictionariesController } from './dictionaries.controller.js';

@Module({
  controllers: [DictionariesController],
  providers: [DictionariesService],
})
export class DictionariesModule {}
