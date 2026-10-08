import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UploadedFile,
} from '@nestjs/common';
import { UsersService } from './users.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UpdateUserPasswordDto } from './dto/update-user-password.dto.js';
import { ImageUpload } from '../storage/image-upload.decorator.js';
import { parseImagePipe } from '../storage/parse-image.pipe.js';

@Controller('users')
@Roles('admin')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Patch(':id/update-info')
  updateUserInfo(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.updateUserInfo(id, dto);
  }

  @Put(':id/update-password')
  updateUserPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserPasswordDto,
  ) {
    return this.usersService.updateUserPassword(id, dto);
  }

  @Put(':id/update-photo')
  @ImageUpload('avatar')
  updateUserPhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile(parseImagePipe) file: Express.Multer.File,
  ) {
    return this.usersService.updateUserPhoto(id, file);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.remove(id);
  }
}
