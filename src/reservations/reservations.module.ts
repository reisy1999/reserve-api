import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReservationsService } from './reservations.service';
import { ReservationsController } from './reservations.controller';
import { AdminSlotsController } from './admin-slots.controller';
import { Reservation } from './entities/reservation.entity';
import { ReservationSlot } from './entities/reservation-slot.entity';
import { ReservationType } from '../reservation-type/entities/reservation-type.entity';
import { Staff } from '../staff/entities/staff.entity';
import { ReservationSlotDepartment } from './entities/reservation-slot-department.entity';
import { Department } from '../department/entities/department.entity';
import { AdminTokenGuard } from '../common/guards/admin-token.guard';
import { AdminReservationsController } from './admin-reservations.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Reservation,
      ReservationSlot,
      ReservationType,
      Staff,
      ReservationSlotDepartment,
      Department,
    ]),
  ],
  controllers: [
    ReservationsController,
    AdminSlotsController,
    AdminReservationsController,
  ],
  providers: [ReservationsService, AdminTokenGuard],
  exports: [ReservationsService],
})
export class ReservationsModule {}
