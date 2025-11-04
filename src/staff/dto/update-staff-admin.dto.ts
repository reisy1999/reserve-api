import {
  IsDefined,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateStaffAdminDto {
  @IsDefined()
  @IsInt()
  @Min(0)
  version!: number;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  familyName?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  givenName?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  familyNameKana?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  givenNameKana?: string;

  @IsOptional()
  @IsString()
  jobTitle?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

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
  @IsEnum(['active', 'suspended', 'left'])
  status?: 'active' | 'suspended' | 'left';

  @IsOptional()
  @IsEnum(['STAFF', 'ADMIN'])
  role?: 'STAFF' | 'ADMIN';
}
