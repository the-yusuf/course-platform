import { Module } from '@nestjs/common';
import { DictionaryCategoriesService } from './dictionary-categories.service.js';
import { DictionaryCategoriesController } from './dictionary-categories.controller.js';

@Module({
  controllers: [DictionaryCategoriesController],
  providers: [DictionaryCategoriesService],
})
export class DictionaryCategoriesModule {}
