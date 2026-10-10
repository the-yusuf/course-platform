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
import { DictionaryCategoriesService } from './dictionary-categories.service.js';
import { CreateDictionaryCategoryDto } from './dto/create-dictionary-category.dto.js';
import { UpdateDictionaryCategoryDto } from './dto/update-dictionary-category.dto.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Public } from '../auth/decorators/public.decorator.js';

@Controller('dictionary-categories')
@Roles('admin')
export class DictionaryCategoriesController {
  constructor(
    private readonly dictionaryCategoriesService: DictionaryCategoriesService,
  ) {}

  @Public()
  @Get()
  async findAll() {
    return this.dictionaryCategoriesService.findAll();
  }

  @Public()
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.dictionaryCategoriesService.findOne(id);
  }

  @Post()
  async create(@Body() dto: CreateDictionaryCategoryDto) {
    return this.dictionaryCategoriesService.create(dto);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDictionaryCategoryDto,
  ) {
    return this.dictionaryCategoriesService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.dictionaryCategoriesService.remove(id);
  }
}
