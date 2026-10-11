import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
} from '@nestjs/common';
import { CoursesService } from './courses.service.js';
import { CreateCourseDto } from './dto/create-course.dto.js';
import { UpdateCourseDto } from './dto/update-course.dto.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { ImageUpload } from '../storage/image-upload.decorator.js';
import { parseOptionalImagePipe } from '../storage/parse-image.pipe.js';
import { PaginationQueryDto } from '../common/pagination.js';
import { ApiEnvelope, ApiPaginated } from '../common/swagger.js';
import { LessonsService } from '../lessons/lessons.service.js';
import { ReorderLessonsDto } from '../lessons/dto/reorder-lessons.dto.js';
import { LessonOutlineEntity } from '../lessons/entities/lesson.entity.js';
import {
  CourseDetailEntity,
  CourseEntity,
  CourseListItemEntity,
} from './entities/course.entity.js';

@Roles('admin')
@Controller('courses')
export class CoursesController {
  constructor(
    private readonly coursesService: CoursesService,
    private readonly lessonsService: LessonsService,
  ) {}

  @Public()
  @Get()
  @ApiPaginated(CourseListItemEntity)
  async findAll(@Query() query: PaginationQueryDto) {
    return this.coursesService.findAll(query);
  }

  @Public()
  @Get(':id')
  @ApiEnvelope(CourseDetailEntity)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.coursesService.findOne(id);
  }

  @Post()
  @ImageUpload('image', CreateCourseDto)
  @ApiEnvelope(CourseEntity, { status: 201 })
  async create(
    @Body() dto: CreateCourseDto,
    @UploadedFile(parseOptionalImagePipe) image?: Express.Multer.File,
  ) {
    return this.coursesService.create(dto, image);
  }

  @Patch(':id')
  @ImageUpload('image', UpdateCourseDto)
  @ApiEnvelope(CourseEntity)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCourseDto,
    @UploadedFile(parseOptionalImagePipe) image?: Express.Multer.File,
  ) {
    return this.coursesService.update(id, dto, image);
  }

  /** Sets the lesson order: send every lesson id of the course, in order */
  @Put(':id/lessons/order')
  @ApiEnvelope(LessonOutlineEntity, { isArray: true })
  async reorderLessons(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReorderLessonsDto,
  ) {
    return this.lessonsService.reorder(id, dto.lesson_ids);
  }

  @Delete(':id')
  @ApiEnvelope(CourseEntity)
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.coursesService.delete(id);
  }
}
