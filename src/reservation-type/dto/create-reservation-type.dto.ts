import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateReservationTypeDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
