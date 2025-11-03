import { Type } from 'class-transformer';
import { IsDefined, IsInt, IsString, Min } from 'class-validator';

export class CheckReservationQueryDto {
  @IsDefined()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  reservationTypeId!: number;

  @IsDefined()
  @IsString()
  periodKey!: string;
}
