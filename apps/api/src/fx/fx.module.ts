import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FxController } from './fx.controller';
import { FxService } from './fx.service';
import { FxSyncService } from './fx-sync.service';

@Global()
@Module({
  imports: [AuthModule],
  controllers: [FxController],
  providers: [FxService, FxSyncService],
  exports: [FxService, FxSyncService],
})
export class FxModule {}
