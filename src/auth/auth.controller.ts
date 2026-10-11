import {
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  Put,
  UploadedFile,
} from '@nestjs/common';
import { CreateUserDto } from '../users/dto/create-user.dto.js';
import { UpdateUserDto } from '../users/dto/update-user.dto.js';
import { UsersService } from '../users/users.service.js';
import { ImageUpload } from '../storage/image-upload.decorator.js';
import { parseImagePipe } from '../storage/parse-image.pipe.js';
import type { AuthUser } from './auth.types.js';
import { AuthService } from './auth.service.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import { Public } from './decorators/public.decorator.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshDto } from './dto/refresh.dto.js';
import { AuthRateLimit, LoginRateLimit } from './throttling.js';
import { ApiNoContentResponse } from '@nestjs/swagger';
import { ApiEnvelope } from '../common/swagger.js';
import { UserEntity } from '../users/entities/user.entity.js';
import { SessionEntity, TokenPairEntity } from './entities/auth.entity.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Public()
  @AuthRateLimit()
  @Post('register')
  @ApiEnvelope(UserEntity, { status: 201 })
  register(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Public()
  @LoginRateLimit()
  @Post('login')
  @HttpCode(200)
  @ApiEnvelope(SessionEntity)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @AuthRateLimit()
  @Post('refresh')
  @HttpCode(200)
  @ApiEnvelope(TokenPairEntity)
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refresh_token);
  }

  @Public()
  @AuthRateLimit()
  @Post('logout')
  @HttpCode(204)
  @ApiNoContentResponse()
  async logout(@Body() dto: RefreshDto) {
    await this.authService.logout(dto.refresh_token);
  }

  @Get('me')
  @ApiEnvelope(UserEntity)
  me(@CurrentUser() user: AuthUser) {
    return this.usersService.findOne(user.id);
  }

  @Patch('me')
  @ApiEnvelope(UserEntity)
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateUserDto) {
    return this.usersService.updateUserInfo(user.id, dto);
  }

  @AuthRateLimit()
  /** Returns a fresh session: the old one ends with the password change */
  @Put('me/password')
  @ApiEnvelope(SessionEntity)
  changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user.id, dto);
  }

  @Put('me/avatar')
  @ImageUpload('avatar')
  @ApiEnvelope(UserEntity)
  updateAvatar(
    @CurrentUser() user: AuthUser,
    @UploadedFile(parseImagePipe) file: Express.Multer.File,
  ) {
    return this.usersService.updateUserPhoto(user.id, file);
  }
}
