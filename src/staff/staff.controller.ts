import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { StaffService } from './staff.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentStaff } from '../common/decorators/current-staff.decorator';
import { Staff } from './entities/staff.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePinDto } from './dto/change-pin.dto';

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

@Controller('staffs')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@CurrentStaff() staff: Staff): StaffResponse {
    return serializeStaff(staff);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  async updateMe(
    @CurrentStaff() staff: Staff,
    @Body() dto: UpdateProfileDto,
  ): Promise<StaffResponse> {
    const updated = await this.staffService.updateProfile(staff, dto);
    return serializeStaff(updated);
  }

  @Post('me/pin')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePin(
    @CurrentStaff() staff: Staff,
    @Body() dto: ChangePinDto,
  ): Promise<void> {
    await this.staffService.changePin(staff, dto.currentPin, dto.newPin);
  }
}
