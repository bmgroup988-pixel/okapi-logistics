import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ParcelsModule } from '../parcels/parcels.module';
import { GroupagesController } from './groupages.controller';
import { GroupagesService } from './groupages.service';

@Module({
  // ParcelsModule : GroupagesService délègue le changement de statut en
  // masse à ParcelsService.transition() (une transition par colis, mêmes
  // règles/notifications/audit que depuis la fiche colis) — voir
  // GroupagesService.transitionAll.
  imports: [AuthModule, ParcelsModule],
  controllers: [GroupagesController],
  providers: [GroupagesService],
})
export class GroupagesModule {}
