import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

export class CreateDepartmentAdminDto {
  @IsString()
  @Length(1, 100)
  id!: string;

  @IsString()
  @Length(1, 255)
  name!: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
