import { Type } from 'class-transformer';
import {
  IsInt,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

export type AdminReservationSortField = 'serviceDateLocal' | 'updatedAt';

export class AdminReservationQueryDto {
  @IsOptional()
  @IsString()
  staffId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  reservationTypeId?: number;

  @IsOptional()
  @IsIn(['active', 'canceled'])
  status?: 'active' | 'canceled';

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
  @IsIn(['serviceDateLocal', 'updatedAt'])
  sort: AdminReservationSortField = 'updatedAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'desc';
}

export interface AdminReservationResponse {
  id: number;
  staffUid: string;
  staffId: string;
  staffName: string;
  departmentId: string | null;
  reservationTypeId: number;
  slotId: number;
  serviceDateLocal: string;
  startMinuteOfDay: number;
  durationMinutes: number;
  canceledAt: Date | null;
  updatedAt: Date;
}

export interface PaginatedAdminReservationsResponse {
  data: AdminReservationResponse[];
  meta: {
    total: number;
    page: number;
    limit: number;
  };
}
