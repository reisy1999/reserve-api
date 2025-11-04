import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class FindStaffsAdminDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 50;
}

export interface StaffAdminListItem {
  staffUid: string;
  staffId: string;
  familyName: string;
  givenName: string;
  departmentId: string;
  jobTitle: string;
  status: string;
  lastLoginAt: Date | null;
  updatedAt: Date;
}

export interface PaginatedStaffAdminResponse {
  data: StaffAdminListItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
  };
}
