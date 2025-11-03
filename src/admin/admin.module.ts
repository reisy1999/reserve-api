import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { ReservationType } from '../reservation-type/entities/reservation-type.entity';
import { ReservationSlot } from '../reservations/entities/reservation-slot.entity';
import { StaffModule } from '../staff/staff.module';
import { AdminTokenGuard } from '../common/guards/admin-token.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([ReservationType, ReservationSlot]),
    StaffModule,
  ],
  controllers: [AdminController],
  providers: [AdminService, AdminTokenGuard],
})
export class AdminModule {}
