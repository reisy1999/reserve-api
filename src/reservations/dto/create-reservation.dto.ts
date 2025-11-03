import { IsDefined, IsInt, Min } from 'class-validator';

export class CreateReservationDto {
  @IsDefined()
  @IsInt()
  @Min(1)
  slotId!: number;
}
