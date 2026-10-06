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
import { DictionariesService } from './dictionaries.service.js';
import { CreateDictionaryDto } from './dto/create-dicionary.dto.js';
import { UpdateDictionaryDto } from './dto/update-dictionary.dto.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

@Controller('dictionaries')
@Roles('admin')
export class DictionariesController {
  constructor(private readonly dictionariesService: DictionariesService) {}

  @Roles('student')
  @Get()
  async findAll() {
    return this.dictionariesService.findAll();
  }

  @Roles('student')
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.dictionariesService.findOne(id);
  }

  @Post()
  async create(@Body() dto: CreateDictionaryDto) {
    return this.dictionariesService.create(dto);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDictionaryDto,
  ) {
    return this.dictionariesService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.dictionariesService.remove(id);
  }
}
