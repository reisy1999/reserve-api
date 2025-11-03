import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReservationTypeService } from './reservation-type.service';
import { ReservationTypeController } from './reservation-type.controller';
import { ReservationType } from './entities/reservation-type.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ReservationType])],
  controllers: [ReservationTypeController],
  providers: [ReservationTypeService],
  exports: [ReservationTypeService],
})
export class ReservationTypeModule {}
