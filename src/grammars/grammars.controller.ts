import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { GrammarsService } from './grammars.service.js';
import { CreateGrammarDto } from './dto/create-grammar.dto.js';
import { UpdateCourseDto } from '../courses/dto/update-course.dto.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

@Controller('grammars')
@Roles('admin')
export class GrammarsController {
  constructor(private readonly grammarsService: GrammarsService) {}

  @Roles('student')
  @Get()
  async findAll() {
    return this.grammarsService.findAll();
  }

  @Roles('student')
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.grammarsService.findOne(id);
  }

  @Post()
  async create(@Body() dto: CreateGrammarDto) {
    return this.grammarsService.create(dto);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCourseDto,
  ) {
    return this.grammarsService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.grammarsService.remove(id);
  }
}
