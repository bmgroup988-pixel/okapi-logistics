import { Global, Module } from '@nestjs/common';
import { NotificationDispatchService } from './notification-dispatch.service';
import { NotificationsService } from './notifications.service';

@Global()
@Module({
  providers: [NotificationsService, NotificationDispatchService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
