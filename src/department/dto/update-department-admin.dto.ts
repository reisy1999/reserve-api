import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

export class UpdateDepartmentAdminDto {
  @IsOptional()
  @IsString()
  @Length(1, 255)
  name?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
