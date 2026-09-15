import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PaymentsModule } from '../payments/payments.module';
import { ParcelDeliveryController } from './parcel-delivery.controller';
import { ParcelDeliveryService } from './parcel-delivery.service';
import { ParcelsController } from './parcels.controller';
import { ParcelsService } from './parcels.service';

@Module({
  // PaymentsModule : requis par ParcelDeliveryService (délégation vers
  // PaymentsService.create() pour l'encaissement joint à la livraison —
  // addendum 08 §4.2 / guide d'intégration complémentaire, docs/09).
  imports: [AuthModule, PaymentsModule],
  controllers: [ParcelsController, ParcelDeliveryController],
  providers: [ParcelsService, ParcelDeliveryService],
  exports: [ParcelsService],
})
export class ParcelsModule {}
