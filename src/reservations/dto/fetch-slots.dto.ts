import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
  IsIn,
} from 'class-validator';
import type { ReservationSlotStatus } from '../entities/reservation-slot.entity';

export class FetchSlotsQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  reservationTypeId!: number;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  serviceDateFrom?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  serviceDateTo?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsIn(['published', 'draft', 'closed'])
  status?: ReservationSlotStatus;
}
