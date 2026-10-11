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
import { GrammarsService } from './grammars.service.js';
import { CreateGrammarDto } from './dto/create-grammar.dto.js';
import { UpdateGrammarDto } from './dto/update-grammar.dto.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthUser } from '../auth/auth.types.js';
import { PaginationQueryDto } from '../common/pagination.js';
import { ApiEnvelope, ApiPaginated } from '../common/swagger.js';
import { GrammarEntity } from './entities/grammar.entity.js';

@Controller('grammars')
@Roles('admin')
export class GrammarsController {
  constructor(private readonly grammarsService: GrammarsService) {}

  @Roles('student')
  @Get()
  @ApiPaginated(GrammarEntity)
  async findAll(
    @CurrentUser() user: AuthUser,
    @Query() query: PaginationQueryDto,
  ) {
    return this.grammarsService.findAll(user, query);
  }

  @Roles('student')
  @Get(':id')
  @ApiEnvelope(GrammarEntity)
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.grammarsService.findOne(id, user);
  }

  @Post()
  @ApiEnvelope(GrammarEntity, { status: 201 })
  async create(@Body() dto: CreateGrammarDto) {
    return this.grammarsService.create(dto);
  }

  @Patch(':id')
  @ApiEnvelope(GrammarEntity)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGrammarDto,
  ) {
    return this.grammarsService.update(id, dto);
  }

  @Delete(':id')
  @ApiEnvelope(GrammarEntity)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.grammarsService.remove(id);
  }
}
