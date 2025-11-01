import { Module } from '@nestjs/common';
import { ReservationTypeService } from './reservation-type.service';
import { ReservationTypeController } from './reservation-type.controller';

@Module({
  controllers: [ReservationTypeController],
  providers: [ReservationTypeService],
})
export class ReservationTypeModule {}
