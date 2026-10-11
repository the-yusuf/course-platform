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
import { DictionaryCategoriesService } from './dictionary-categories.service.js';
import { CreateDictionaryCategoryDto } from './dto/create-dictionary-category.dto.js';
import { UpdateDictionaryCategoryDto } from './dto/update-dictionary-category.dto.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { PaginationQueryDto } from '../common/pagination.js';
import { ApiEnvelope, ApiPaginated } from '../common/swagger.js';
import {
  DictionaryCategoryDetailEntity,
  DictionaryCategoryEntity,
  DictionaryCategoryListItemEntity,
} from './entities/dictionary-category.entity.js';

@Controller('dictionary-categories')
@Roles('admin')
export class DictionaryCategoriesController {
  constructor(
    private readonly dictionaryCategoriesService: DictionaryCategoriesService,
  ) {}

  @Public()
  @Get()
  @ApiPaginated(DictionaryCategoryListItemEntity)
  async findAll(@Query() query: PaginationQueryDto) {
    return this.dictionaryCategoriesService.findAll(query);
  }

  @Public()
  @Get(':id')
  @ApiEnvelope(DictionaryCategoryDetailEntity)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.dictionaryCategoriesService.findOne(id);
  }

  @Post()
  @ApiEnvelope(DictionaryCategoryEntity, { status: 201 })
  async create(@Body() dto: CreateDictionaryCategoryDto) {
    return this.dictionaryCategoriesService.create(dto);
  }

  @Patch(':id')
  @ApiEnvelope(DictionaryCategoryEntity)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDictionaryCategoryDto,
  ) {
    return this.dictionaryCategoriesService.update(id, dto);
  }

  @Delete(':id')
  @ApiEnvelope(DictionaryCategoryEntity)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.dictionaryCategoriesService.remove(id);
  }
}
