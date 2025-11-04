import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { CheckReservationQueryDto } from './dto/check-reservation-query.dto';
import { CheckReservationResponseDto } from './dto/check-reservation-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentStaff } from '../common/decorators/current-staff.decorator';
import { Staff } from '../staff/entities/staff.entity';
import type { Reservation } from './entities/reservation.entity';

@Controller('reservations')
@UseGuards(JwtAuthGuard)
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Get('check')
  async checkReservation(
    @CurrentStaff() staff: Staff,
    @Query() query: CheckReservationQueryDto,
  ): Promise<CheckReservationResponseDto> {
    const reservation = await this.reservationsService.findByStaffTypeAndPeriod(
      staff.staffUid,
      query.reservationTypeId,
      query.periodKey,
    );

    return {
      exists: !!reservation,
      reservation: reservation || undefined,
    };
  }

  @Post()
  create(
    @CurrentStaff() staff: Staff,
    @Body() dto: CreateReservationDto,
  ): Promise<Reservation> {
    return this.reservationsService.createForStaff(staff, dto.slotId);
  }

  @Delete(':id')
  @HttpCode(204)
  async cancel(
    @CurrentStaff() staff: Staff,
    @Param('id', ParseIntPipe) reservationId: number,
  ): Promise<void> {
    await this.reservationsService.cancelForStaff(staff, reservationId);
  }
}
