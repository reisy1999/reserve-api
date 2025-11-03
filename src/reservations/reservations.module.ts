import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReservationsService } from './reservations.service';
import { ReservationsController } from './reservations.controller';
import { Reservation } from './entities/reservation.entity';
import { ReservationSlot } from './entities/reservation-slot.entity';
import { ReservationType } from '../reservation-type/entities/reservation-type.entity';
import { Staff } from '../staff/entities/staff.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Reservation,
      ReservationSlot,
      ReservationType,
      Staff,
    ]),
  ],
  controllers: [ReservationsController],
  providers: [ReservationsService],
  exports: [ReservationsService],
})
export class ReservationsModule {}
