import {
  IsDefined,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateProfileDto {
  @IsDefined()
  @IsInt()
  @Min(0)
  version!: number;

  @IsOptional()
  @IsString()
  currentPin?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+$/)
  @MaxLength(64)
  emrPatientId?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[12]$/)
  sexCode?: '1' | '2';

  @IsOptional()
  @IsString()
  familyNameKana?: string;

  @IsOptional()
  @IsString()
  givenNameKana?: string;

  @IsOptional()
  @IsString()
  jobTitle?: string;
}
