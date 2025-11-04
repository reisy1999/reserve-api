import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AdminJwtGuard } from '../auth/guards/admin-jwt.guard';
import { StaffService } from './staff.service';
import { UpdateStaffAdminDto } from './dto/update-staff-admin.dto';
import { Staff } from './entities/staff.entity';

interface StaffResponse {
  staffUid: string;
  staffId: string;
  emrPatientId: string | null;
  familyName: string;
  givenName: string;
  familyNameKana: string | null;
  givenNameKana: string | null;
  jobTitle: string;
  departmentId: string;
  dateOfBirth: string;
  sexCode: '1' | '2';
  pinMustChange: boolean;
  pinRetryCount: number;
  pinLockedUntil: Date | null;
  status: Staff['status'];
  role: Staff['role'];
  version: number;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function serializeStaff(staff: Staff): StaffResponse {
  return {
    staffUid: staff.staffUid,
    staffId: staff.staffId,
    emrPatientId: staff.emrPatientId,
    familyName: staff.familyName,
    givenName: staff.givenName,
    familyNameKana: staff.familyNameKana,
    givenNameKana: staff.givenNameKana,
    jobTitle: staff.jobTitle,
    departmentId: staff.departmentId,
    dateOfBirth: staff.dateOfBirth,
    sexCode: staff.sexCode,
    pinMustChange: staff.pinMustChange,
    pinRetryCount: staff.pinRetryCount,
    pinLockedUntil: staff.pinLockedUntil,
    status: staff.status,
    role: staff.role,
    version: staff.version,
    lastLoginAt: staff.lastLoginAt,
    createdAt: staff.createdAt,
    updatedAt: staff.updatedAt,
  };
}

@Controller('admin/staffs')
@UseGuards(AdminJwtGuard)
export class AdminStaffController {
  constructor(private readonly staffService: StaffService) {}

  @Patch(':staffUid')
  async updateStaff(
    @Param('staffUid') staffUid: string,
    @Body() dto: UpdateStaffAdminDto,
  ): Promise<StaffResponse> {
    const updated = await this.staffService.updateStaffByAdmin(staffUid, dto);
    return serializeStaff(updated);
  }

  @Post(':staffUid/reset-pin')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPin(@Param('staffUid') staffUid: string): Promise<void> {
    await this.staffService.resetPinByAdmin(staffUid);
  }
}
