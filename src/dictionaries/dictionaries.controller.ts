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
import { DictionariesService } from './dictionaries.service.js';
import { CreateDictionaryDto } from './dto/create-dicionary.dto.js';
import { UpdateDictionaryDto } from './dto/update-dictionary.dto.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthUser } from '../auth/auth.types.js';
import { PaginationQueryDto } from '../common/pagination.js';
import { ApiEnvelope, ApiPaginated } from '../common/swagger.js';
import { DictionaryEntity } from './entities/dictionary.entity.js';

@Controller('dictionaries')
@Roles('admin')
export class DictionariesController {
  constructor(private readonly dictionariesService: DictionariesService) {}

  @Roles('student')
  @Get()
  @ApiPaginated(DictionaryEntity)
  async findAll(
    @CurrentUser() user: AuthUser,
    @Query() query: PaginationQueryDto,
  ) {
    return this.dictionariesService.findAll(user, query);
  }

  @Roles('student')
  @Get(':id')
  @ApiEnvelope(DictionaryEntity)
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.dictionariesService.findOne(id, user);
  }

  @Post()
  @ApiEnvelope(DictionaryEntity, { status: 201 })
  async create(@Body() dto: CreateDictionaryDto) {
    return this.dictionariesService.create(dto);
  }

  @Patch(':id')
  @ApiEnvelope(DictionaryEntity)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDictionaryDto,
  ) {
    return this.dictionariesService.update(id, dto);
  }

  @Delete(':id')
  @ApiEnvelope(DictionaryEntity)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.dictionariesService.remove(id);
  }
}
