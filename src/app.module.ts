import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module.js';
import { UsersModule } from './users/users.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CoursesModule } from './courses/courses.module.js';
import { LessonsModule } from './lessons/lessons.module.js';
import { DictionaryCategoriesModule } from './dictionary-categories/dictionary-categories.module.js';
import { DictionariesModule } from './dictionaries/dictionaries.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuthModule,
    UsersModule,
    CoursesModule,
    LessonsModule,
    DictionaryCategoriesModule,
    DictionariesModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
