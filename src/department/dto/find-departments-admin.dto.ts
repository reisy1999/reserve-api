import { Transform, Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsBoolean,
  IsInt,
  Min,
  Max,
  IsIn,
} from 'class-validator';

export class FindDepartmentsAdminDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (typeof value === 'boolean') return value;
    // If value is undefined or null, return undefined
    if (value === undefined || value === null) return undefined;
    // For any other value, keep it for validation to catch
    return value;
  }, { toClassOnly: true })
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsIn(['id', 'name', 'updatedAt'])
  sort?: 'id' | 'name' | 'updatedAt' = 'id';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc' = 'asc';
}

export interface DepartmentAdminResponse {
  id: string;
  name: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedDepartmentsResponse {
  data: DepartmentAdminResponse[];
  meta: {
    total: number;
    page: number;
    limit: number;
  };
}
