import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { DatabaseModule } from './database/database.module.js';
import { UsersModule } from './users/users.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CoursesModule } from './courses/courses.module.js';
import { LessonsModule } from './lessons/lessons.module.js';
import { DictionaryCategoriesModule } from './dictionary-categories/dictionary-categories.module.js';
import { DictionariesModule } from './dictionaries/dictionaries.module.js';
import { ReviewsModule } from './reviews/reviews.module.js';
import { GrammarsModule } from './grammars/grammars.module.js';
import { StoriesModule } from './stories/stories.module.js';
import { EnrollmentsModule } from './enrollments/enrollments.module.js';
import { StorageModule } from './storage/storage.module.js';
import { HealthModule } from './health/health.module.js';
import { validateEnv } from './config/env.validation.js';
import { AllExceptionsFilter } from './common/http/all-exceptions.filter.js';
import { ResponseEnvelopeInterceptor } from './common/http/response-envelope.interceptor.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    DatabaseModule,
    StorageModule,
    AuthModule,
    UsersModule,
    CoursesModule,
    LessonsModule,
    DictionaryCategoriesModule,
    DictionariesModule,
    ReviewsModule,
    GrammarsModule,
    StoriesModule,
    EnrollmentsModule,
    HealthModule,
  ],
  controllers: [],
  providers: [
    // every response: { statusCode, message, data (, meta) }
    { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
    // every error: { statusCode, message, error, data: null }
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
