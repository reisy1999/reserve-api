import { IsInt, IsString, Min, Max, Matches } from 'class-validator';

export class CreateReservationDto {
    @IsInt() staffId!: number;

    @IsString()
    @Matches(/~\d{4}-\d{2}-\d{2}$/) //YYYY-MM-DD
    date!: string;

    @IsInt() @Min(0) @Max(1440) start_min!: number;
    @IsInt() @Min(0) @Max(1440) end_min!: number;
}
