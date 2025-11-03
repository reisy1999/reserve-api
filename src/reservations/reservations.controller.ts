import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentStaff } from '../common/decorators/current-staff.decorator';
import { Staff } from '../staff/entities/staff.entity';
import type { Reservation } from './entities/reservation.entity';

@Controller('reservations')
@UseGuards(JwtAuthGuard)
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Post()
  create(
    @CurrentStaff() staff: Staff,
    @Body() dto: CreateReservationDto,
  ): Promise<Reservation> {
    return this.reservationsService.createForStaff(staff, dto.slotId);
  }
}
