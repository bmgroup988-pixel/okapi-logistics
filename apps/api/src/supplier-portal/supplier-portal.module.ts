import { Module } from '@nestjs/common';
import { FxModule } from '../fx/fx.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SequenceModule } from '../sequences/sequence.module';
import { SettingsModule } from '../settings/settings.module';
import { StorageModule } from '../storage/storage.module';
import { SupplierPortalController } from './supplier-portal.controller';
import { SupplierPortalService } from './supplier-portal.service';
import { SupplierShipmentsStaffController } from './supplier-shipments-staff.controller';

@Module({
  imports: [FxModule, SequenceModule, StorageModule, SettingsModule, NotificationsModule],
  controllers: [SupplierPortalController, SupplierShipmentsStaffController],
  providers: [SupplierPortalService],
})
export class SupplierPortalModule {}
