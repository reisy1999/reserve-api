import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReservationTypeService } from './reservation-type.service';
import { ReservationTypeController } from './reservation-type.controller';
import { AdminReservationTypeController } from './admin-reservation-type.controller';
import { ReservationType } from './entities/reservation-type.entity';
import { AdminTokenGuard } from '../common/guards/admin-token.guard';

@Module({
  imports: [TypeOrmModule.forFeature([ReservationType])],
  controllers: [ReservationTypeController, AdminReservationTypeController],
  providers: [ReservationTypeService, AdminTokenGuard],
  exports: [ReservationTypeService],
})
export class ReservationTypeModule {}
