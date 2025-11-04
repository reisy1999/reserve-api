import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  IsIn,
} from 'class-validator';
import type { ReservationSlotStatus } from '../entities/reservation-slot.entity';

export type AdminSlotSortField =
  | 'serviceDateLocal'
  | 'startMinuteOfDay'
  | 'updatedAt';

export class AdminSlotQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  reservationTypeId?: number;

  @IsOptional()
  @IsIn(['draft', 'published', 'closed'])
  status?: ReservationSlotStatus;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  serviceDateFrom?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  serviceDateTo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 50;

  @IsOptional()
  @IsIn(['serviceDateLocal', 'startMinuteOfDay', 'updatedAt'])
  sort: AdminSlotSortField = 'serviceDateLocal';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'asc';
}

export interface AdminSlotResponse {
  id: number;
  reservationTypeId: number;
  serviceDateLocal: string;
  startMinuteOfDay: number;
  durationMinutes: number;
  capacity: number;
  bookedCount: number;
  status: ReservationSlotStatus;
  bookingStart: Date | null;
  bookingEnd: Date | null;
  cancelDeadlineDateLocal: string | null;
  cancelDeadlineMinuteOfDay: number | null;
  notes: string | null;
  updatedAt: Date;
}

export interface PaginatedAdminSlotsResponse {
  data: AdminSlotResponse[];
  meta: {
    total: number;
    page: number;
    limit: number;
  };
}
