import { Type, Transform, type TransformFnParams } from 'class-transformer';
import {
  IsInt,
  IsISO8601,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import type { ReservationSlotStatus } from '../entities/reservation-slot.entity';

export class UpdateSlotAdminDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  capacity?: number;

  @IsOptional()
  @IsIn(['draft', 'published', 'closed'])
  status?: ReservationSlotStatus;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  notes?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsISO8601()
  bookingStart?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsISO8601()
  bookingEnd?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  cancelDeadlineDateLocal?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Transform(({ value }: TransformFnParams) => {
    if (value === undefined) {
      return undefined;
    }
    if (value === null) {
      return null;
    }
    if (value === '') {
      return null;
    }
    if (typeof value === 'number') return value;
    const numericValue = Number(value);
    return numericValue;
  })
  @IsInt()
  @Min(0)
  @Max(1439)
  cancelDeadlineMinuteOfDay?: number | null;
}
