import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { loginSchema, refreshSchema, type AuthTokensDto } from '@okapi/shared';
import { z } from 'zod';
import type { Request } from 'express';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AuthService } from './auth.service';
import type { CurrentUser as CurrentUserType } from './current-user';
import { CurrentUser, Public } from './decorators';

const otpBodySchema = z.object({ otp: z.string().regex(/^\d{6}$/) });

function ctxOf(req: Request) {
  return {
    ip: req.ip ?? null,
    userAgent: req.header('user-agent') ?? null,
    requestId: req.requestId ?? null,
  };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  login(
    @Body(new ZodValidationPipe(loginSchema)) body: z.infer<typeof loginSchema>,
    @Req() req: Request,
  ): Promise<AuthTokensDto> {
    return this.auth.login(body.email, body.password, body.otp, ctxOf(req));
  }

  @Public()
  @Post('token')
  @HttpCode(200)
  refresh(
    @Body(new ZodValidationPipe(refreshSchema)) body: z.infer<typeof refreshSchema>,
    @Req() req: Request,
  ): Promise<AuthTokensDto> {
    return this.auth.refresh(body.refreshToken, ctxOf(req));
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(
    @Body(new ZodValidationPipe(refreshSchema)) body: z.infer<typeof refreshSchema>,
  ): Promise<void> {
    await this.auth.logout(body.refreshToken);
  }

  @Post('mfa/enroll')
  mfaEnroll(@CurrentUser() user: CurrentUserType) {
    return this.auth.mfaEnroll(user);
  }

  @Post('mfa/verify')
  @HttpCode(204)
  async mfaVerify(
    @CurrentUser() user: CurrentUserType,
    @Body(new ZodValidationPipe(otpBodySchema)) body: z.infer<typeof otpBodySchema>,
  ): Promise<void> {
    await this.auth.mfaVerify(user, body.otp);
  }
}
