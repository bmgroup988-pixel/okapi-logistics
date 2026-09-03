import { Module } from '@nestjs/common';
import { PublicTrackingController } from './public-tracking.controller';

@Module({
  controllers: [PublicTrackingController],
})
export class PublicTrackingModule {}
