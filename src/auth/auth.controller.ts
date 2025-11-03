import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService, type TokenResponse } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto, @Req() req: Request): Promise<TokenResponse> {
    return this.authService.login(
      dto,
      req.headers['user-agent'],
      req.ip ?? req.socket.remoteAddress ?? undefined,
    );
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
  ): Promise<TokenResponse> {
    return this.authService.refreshToken(
      dto,
      req.headers['user-agent'],
      req.ip ?? req.socket.remoteAddress ?? undefined,
    );
  }
}
