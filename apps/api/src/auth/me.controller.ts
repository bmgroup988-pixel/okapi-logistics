import { Controller, Get } from '@nestjs/common';
import type { MeDto } from '@okapi/shared';
import { AuthService } from './auth.service';
import type { CurrentUser as CurrentUserType } from './current-user';
import { CurrentUser, MfaExempt } from './decorators';

@Controller('me')
export class MeController {
  constructor(private readonly auth: AuthService) {}

  @MfaExempt()
  @Get()
  me(@CurrentUser() user: CurrentUserType): Promise<MeDto> {
    return this.auth.me(user);
  }
}
