import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { LessonsService } from './lessons.service.js';
import { CreateLessonDto } from './dto/create-lesson.dto.js';
import { UpdateLessonDto } from './dto/update-lesson.dto.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthUser } from '../auth/auth.types.js';
import { PaginationQueryDto } from '../common/pagination.js';
import { ApiEnvelope, ApiPaginated } from '../common/swagger.js';
import {
  LessonDetailEntity,
  LessonEntity,
  LessonListItemEntity,
} from './entities/lesson.entity.js';

@Controller('lessons')
@Roles('admin')
export class LessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  @Get()
  @ApiPaginated(LessonListItemEntity)
  async findAll(@Query() query: PaginationQueryDto) {
    return this.lessonsService.findAll(query);
  }

  /** Students need to be enrolled in the lesson's course */
  @Roles('student')
  @Get(':id')
  @ApiEnvelope(LessonDetailEntity)
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.lessonsService.findOne(id, user);
  }

  @Post()
  @ApiEnvelope(LessonEntity, { status: 201 })
  async create(@Body() dto: CreateLessonDto) {
    return this.lessonsService.create(dto);
  }

  @Patch(':id')
  @ApiEnvelope(LessonEntity)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLessonDto,
  ) {
    return this.lessonsService.update(id, dto);
  }

  @Delete(':id')
  @ApiEnvelope(LessonEntity)
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.lessonsService.delete(id);
  }
}
