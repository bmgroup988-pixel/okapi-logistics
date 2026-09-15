import { Module } from '@nestjs/common';
import { PartnerSettlementsController } from './partner-settlements.controller';
import { PartnerSettlementsService } from './partner-settlements.service';

@Module({
  controllers: [PartnerSettlementsController],
  providers: [PartnerSettlementsService],
})
export class PartnerSettlementsModule {}
