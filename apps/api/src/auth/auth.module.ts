import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { MeController } from './me.controller';
import { PasswordService } from './password.service';
import { PermissionsGuard } from './permissions.guard';
import { TokenService } from './token.service';

@Module({
  controllers: [AuthController, MeController],
  providers: [AuthService, TokenService, PasswordService, JwtAuthGuard, PermissionsGuard],
  exports: [AuthService, TokenService, PasswordService, JwtAuthGuard, PermissionsGuard],
})
export class AuthModule {}
