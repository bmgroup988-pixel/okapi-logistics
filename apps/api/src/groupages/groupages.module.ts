import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GroupagesController } from './groupages.controller';
import { GroupagesService } from './groupages.service';

@Module({
  imports: [AuthModule],
  controllers: [GroupagesController],
  providers: [GroupagesService],
})
export class GroupagesModule {}
