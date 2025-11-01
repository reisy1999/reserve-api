import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ReservationsModule } from './reservations/reservations.module';
import { DepartmentModule } from './department/department.module';
import { StaffModule } from './staff/staff.module';
import { ReservationTypeModule } from './reservation-type/reservation-type.module';

@Module({
  imports: [
    ReservationsModule,
    DepartmentModule,
    StaffModule,
    ReservationTypeModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
