import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import { AdminTokenGuard } from '../common/guards/admin-token.guard';
import {
  AdminReservationQueryDto,
  type PaginatedAdminReservationsResponse,
} from './dto/admin-reservations.dto';

@Controller('admin/reservations')
@UseGuards(AdminTokenGuard)
export class AdminReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Get()
  async listReservations(
    @Query() query: AdminReservationQueryDto,
  ): Promise<PaginatedAdminReservationsResponse> {
    return this.reservationsService.findReservationsForAdmin(query);
  }

  @Delete(':id')
  @HttpCode(204)
  async cancelReservation(
    @Param('id', ParseIntPipe) reservationId: number,
  ): Promise<void> {
    await this.reservationsService.cancelReservationByAdmin(reservationId);
  }
}
