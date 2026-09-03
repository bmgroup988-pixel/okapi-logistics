import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TariffsController } from './tariffs.controller';
import { TariffsService } from './tariffs.service';

@Module({
  imports: [AuthModule],
  controllers: [TariffsController],
  providers: [TariffsService],
})
export class TariffsModule {}
