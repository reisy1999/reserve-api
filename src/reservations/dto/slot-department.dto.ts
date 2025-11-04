import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class LinkDepartmentDto {
  @IsString()
  departmentId!: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  capacityOverride?: number | null;
}

export class UpdateSlotDepartmentDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  capacityOverride?: number | null;
}

export interface SlotDepartmentResponse {
  id: number;
  slotId: number;
  departmentId: string;
  enabled: boolean;
  capacityOverride: number | null;
  createdAt: Date;
  updatedAt: Date;
}
