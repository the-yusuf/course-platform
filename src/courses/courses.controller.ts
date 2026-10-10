import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
} from '@nestjs/common';
import { CoursesService } from './courses.service.js';
import { CreateCourseDto } from './dto/create-course.dto.js';
import { UpdateCourseDto } from './dto/update-course.dto.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { ImageUpload } from '../storage/image-upload.decorator.js';
import { parseOptionalImagePipe } from '../storage/parse-image.pipe.js';

@Roles('admin')
@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Public()
  @Get()
  async findAll() {
    return this.coursesService.findAll();
  }

  @Public()
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.coursesService.findOne(id);
  }

  @Post()
  @ImageUpload('image', CreateCourseDto)
  async create(
    @Body() dto: CreateCourseDto,
    @UploadedFile(parseOptionalImagePipe) image?: Express.Multer.File,
  ) {
    return this.coursesService.create(dto, image);
  }

  @Patch(':id')
  @ImageUpload('image', UpdateCourseDto)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCourseDto,
    @UploadedFile(parseOptionalImagePipe) image?: Express.Multer.File,
  ) {
    return this.coursesService.update(id, dto, image);
  }

  @Delete(':id')
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.coursesService.delete(id);
  }
}
