import { Module } from '@nestjs/common';
import { FxModule } from '../fx/fx.module';
import { SequenceModule } from '../sequences/sequence.module';
import { SettingsModule } from '../settings/settings.module';
import { StorageModule } from '../storage/storage.module';
import { SupplierPortalController } from './supplier-portal.controller';
import { SupplierPortalService } from './supplier-portal.service';

@Module({
  imports: [FxModule, SequenceModule, StorageModule, SettingsModule],
  controllers: [SupplierPortalController],
  providers: [SupplierPortalService],
})
export class SupplierPortalModule {}
