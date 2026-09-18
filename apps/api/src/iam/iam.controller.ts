import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { paginationSchema } from '@okapi/shared';
import type { Request } from 'express';
import { z } from 'zod';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import type { CurrentUser as CurrentUserType } from '../auth/current-user';
import { CurrentUser, RequirePermissions } from '../auth/decorators';
import { IamService } from './iam.service';
import {
  roleAssignSchema,
  userCreateSchema,
  userUpdateSchema,
  type RoleAssignInput,
  type UserCreateInput,
  type UserUpdateInput,
} from './iam.schemas';

const listQuerySchema = paginationSchema.extend({ q: z.string().max(120).optional() });

@Controller('admin/users')
@RequirePermissions('user:manage')
export class IamController {
  constructor(private readonly iam: IamService) {}

  @Get()
  list(@Query(new ZodValidationPipe(listQuerySchema)) query: z.infer<typeof listQuerySchema>) {
    return this.iam.list(query.page, query.limit, query.q);
  }

  @Post()
  create(
    @Body(new ZodValidationPipe(userCreateSchema)) body: UserCreateInput,
    @CurrentUser() user: CurrentUserType,
    @Req() req: Request,
  ) {
    return this.iam.create(body, user, req.requestId);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(userUpdateSchema)) body: UserUpdateInput,
    @CurrentUser() user: CurrentUserType,
    @Req() req: Request,
  ) {
    return this.iam.update(id, body, user, req.requestId);
  }

  @Post(':id/roles')
  assignRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(roleAssignSchema)) body: RoleAssignInput,
    @CurrentUser() user: CurrentUserType,
    @Req() req: Request,
  ) {
    return this.iam.assignRole(id, body, user, req.requestId);
  }

  @Delete(':id/roles/:userRoleId')
  @HttpCode(204)
  async revokeRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userRoleId', ParseUUIDPipe) userRoleId: string,
    @CurrentUser() user: CurrentUserType,
    @Req() req: Request,
  ): Promise<void> {
    await this.iam.revokeRole(id, userRoleId, user, req.requestId);
  }

  @Post(':id/reset-password')
  resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserType,
    @Req() req: Request,
  ) {
    return this.iam.resetPassword(id, user, req.requestId);
  }

  @Post(':id/reset-mfa')
  @HttpCode(204)
  async resetMfa(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserType,
    @Req() req: Request,
  ): Promise<void> {
    await this.iam.resetMfa(id, user, req.requestId);
  }
}
