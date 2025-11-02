import { Type } from 'class-transformer';
import {
  IsDefined,
  IsInt,
  IsPositive,
  Min,
  Max,
  Matches,
  IsString,
  IsNotEmpty,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

const YMD = /^\d{4}-\d{2}-\d{2}$/;

@ValidatorConstraint({ name: 'IsRealYmd', async: false })
class IsRealYmdConstraint implements ValidatorConstraintInterface {
  validate(value: string): boolean {
    if (!YMD.test(value)) return false;
    const [y, m, d] = value.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return (
      dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
    );
  }
  defaultMessage() {
    return 'serviceDateLocal must be a real calendar date (YYYY-MM-DD).';
  }
}

export class CreateReservationDto {
  @IsDefined()
  @Matches(YMD, { message: 'serviceDateLocal must match YYYY-MM-DD' })
  @Validate(IsRealYmdConstraint)
  serviceDateLocal!: string;

  @IsDefined()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1439)
  startMinuteOfDay!: number;

  @IsDefined()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  durationMinutes!: number;

  @IsDefined()
  @Type(() => String)
  @IsString()
  @IsNotEmpty()
  staffId!: string;

  @IsDefined()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  reservationTypeId!: number;
}
