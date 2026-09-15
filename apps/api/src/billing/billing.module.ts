import { Global, Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { BillingService } from './billing.service';

@Global()
@Module({
  imports: [SettingsModule],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
