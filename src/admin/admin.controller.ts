import { Body, Controller, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AdminService, type ImportResponse } from './admin.service';
import type { ReservationType } from '../reservation-type/entities/reservation-type.entity';
import type { ReservationSlot } from '../reservations/entities/reservation-slot.entity';
import { AdminTokenGuard } from '../common/guards/admin-token.guard';

interface BulkSlotDto {
  slots: Array<{
    reservationTypeId: number;
    serviceDateLocal: string;
    startMinuteOfDay: number;
    durationMinutes: number;
    capacity: number;
    status: 'draft' | 'published' | 'closed';
    bookingStart?: string | null;
    bookingEnd?: string | null;
    notes?: string | null;
  }>;
}

interface CreateReservationTypeBody {
  name: string;
  description?: string;
  active?: boolean;
}

@Controller('admin')
@UseGuards(AdminTokenGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  private extractCsvPayload(
    req: Request & { rawBody?: string | Buffer | undefined },
  ): string {
    if (!req) {
      return '';
    }
    const existing: unknown = req.body;
    if (typeof existing === 'string') {
      return existing;
    }
    if (Buffer.isBuffer(existing)) {
      return existing.toString('utf8');
    }
    const rawBody = req.rawBody;
    if (typeof rawBody === 'string') {
      return rawBody;
    }
    if (Buffer.isBuffer(rawBody)) {
      return rawBody.toString('utf8');
    }
    return '';
  }

  @Post('staffs/import')
  importStaffs(
    @Req() req: Request,
    @Query('dryRun') dryRun?: string,
  ): Promise<ImportResponse> {
    const isDryRun = (dryRun ?? 'false').toLowerCase() === 'true';
    const payload = this.extractCsvPayload(req);
    return this.adminService.importStaffs(payload, isDryRun);
  }

  @Post('reservation-types')
  createReservationType(
    @Body() body: CreateReservationTypeBody,
  ): Promise<ReservationType> {
    return this.adminService.createReservationType(body);
  }

  @Post('slots/bulk')
  createSlots(
    @Body() body: BulkSlotDto,
  ): Promise<{ slots: ReservationSlot[] }> {
    return this.adminService.createSlots(body.slots ?? []);
  }
}
