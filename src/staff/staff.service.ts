import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SecurityService } from '../security/security.service';
import { Staff } from './entities/staff.entity';
import { Department } from '../department/entities/department.entity';

export interface StaffImportPayload {
  staffId: string;
  fullName: string;
  departmentId: string;
  jobTitle: string;
}

export interface UpdateProfilePayload {
  version: number;
  currentPin?: string;
  emrPatientId?: string | null;
  dateOfBirth?: string;
  sexCode?: '1' | '2';
  familyNameKana?: string | null;
  givenNameKana?: string | null;
  jobTitle?: string;
}

@Injectable()
export class StaffService {
  private readonly maxPinAttempts = 5;

  constructor(
    @InjectRepository(Staff)
    private readonly staffRepository: Repository<Staff>,
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,
    private readonly securityService: SecurityService,
  ) {}

  findByStaffId(staffId: string): Promise<Staff | null> {
    return this.staffRepository.findOne({
      where: { staffId },
      relations: ['department'],
    });
  }

  findByStaffUid(staffUid: string): Promise<Staff | null> {
    return this.staffRepository.findOne({
      where: { staffUid },
      relations: ['department'],
    });
  }

  async ensureDepartment(
    departmentId: string,
    name?: string,
  ): Promise<Department> {
    const id = departmentId.trim();
    let department = await this.departmentRepository.findOne({ where: { id } });
    if (!department) {
      department = this.departmentRepository.create({
        id,
        name: name ?? id,
        active: true,
      });
      await this.departmentRepository.save(department);
    }
    return department;
  }

  async createFromImport(payload: StaffImportPayload): Promise<Staff> {
    const now = new Date();
    const department = await this.ensureDepartment(payload.departmentId);

    const pinHash = await this.securityService.hash('0000');
    const staff = this.staffRepository.create({
      staffId: payload.staffId,
      familyName: payload.fullName,
      givenName: payload.fullName,
      familyNameKana: null,
      givenNameKana: null,
      department,
      departmentId: department.id,
      jobTitle: payload.jobTitle ?? '未設定',
      emrPatientId: null,
      dateOfBirth: '1900-01-01',
      sexCode: '1',
      pinHash,
      pinRetryCount: 0,
      pinLockedUntil: null,
      pinUpdatedAt: now,
      pinVersion: 1,
      pinMustChange: true,
      version: 0,
      status: 'active',
      role: 'STAFF',
      lastLoginAt: null,
    });
    return this.staffRepository.save(staff);
  }

  async incrementFailedPin(staff: Staff): Promise<Staff> {
    staff.pinRetryCount += 1;
    if (staff.pinRetryCount >= this.maxPinAttempts) {
      staff.pinLockedUntil = new Date();
    }
    return this.staffRepository.save(staff);
  }

  async resetPinFailures(staff: Staff): Promise<Staff> {
    staff.pinRetryCount = 0;
    staff.pinLockedUntil = null;
    return this.staffRepository.save(staff);
  }

  async recordSuccessfulLogin(staff: Staff): Promise<void> {
    staff.lastLoginAt = new Date();
    await this.staffRepository.save(staff);
  }

  async updateStatus(staff: Staff, status: Staff['status']): Promise<void> {
    staff.status = status;
    await this.staffRepository.save(staff);
  }

  private requiresReauth(payload: UpdateProfilePayload): boolean {
    return (
      payload.emrPatientId !== undefined ||
      payload.dateOfBirth !== undefined ||
      payload.sexCode !== undefined ||
      payload.jobTitle !== undefined
    );
  }

  async updateProfile(
    staff: Staff,
    payload: UpdateProfilePayload,
  ): Promise<Staff> {
    if (staff.version !== payload.version) {
      throw new ConflictException('Version mismatch');
    }

    if (this.requiresReauth(payload)) {
      if (!payload.currentPin) {
        throw new HttpException('PIN re-authentication required', 428);
      }
      const valid = await this.securityService.verify(
        payload.currentPin,
        staff.pinHash,
      );
      if (!valid) {
        throw new HttpException('PIN mismatch', 428);
      }
    }

    if (payload.emrPatientId !== undefined) {
      if (payload.emrPatientId && !/^\d+$/.test(payload.emrPatientId)) {
        throw new BadRequestException('emrPatientId must be numeric');
      }
      if (payload.emrPatientId) {
        const other = await this.staffRepository.findOne({
          where: { emrPatientId: payload.emrPatientId },
        });
        if (other && other.staffUid !== staff.staffUid) {
          throw new BadRequestException('emrPatientId already exists.');
        }
      }
      staff.emrPatientId = payload.emrPatientId ?? null;
    }

    if (payload.dateOfBirth !== undefined) {
      staff.dateOfBirth = payload.dateOfBirth;
    }
    if (payload.sexCode !== undefined) {
      staff.sexCode = payload.sexCode;
    }
    if (payload.familyNameKana !== undefined) {
      staff.familyNameKana = payload.familyNameKana ?? null;
    }
    if (payload.givenNameKana !== undefined) {
      staff.givenNameKana = payload.givenNameKana ?? null;
    }
    if (payload.jobTitle !== undefined) {
      staff.jobTitle = payload.jobTitle;
    }

    staff.version += 1;
    return this.staffRepository.save(staff);
  }

  async changePin(
    staff: Staff,
    currentPin: string,
    newPin: string,
  ): Promise<void> {
    const isValid = await this.securityService.verify(
      currentPin,
      staff.pinHash,
    );
    if (!isValid) {
      throw new HttpException('Current PIN is invalid', 428);
    }
    if (!/^\d{4}$/.test(newPin)) {
      throw new BadRequestException('PIN must be 4 digits');
    }
    staff.pinHash = await this.securityService.hash(newPin);
    staff.pinUpdatedAt = new Date();
    staff.pinMustChange = false;
    staff.pinRetryCount = 0;
    staff.pinLockedUntil = null;
    staff.pinVersion += 1;
    await this.staffRepository.save(staff);
  }

  async unlockPin(staffUid: string): Promise<void> {
    const staff = await this.findByStaffUid(staffUid);
    if (!staff) {
      throw new NotFoundException('Staff not found');
    }
    staff.pinRetryCount = 0;
    staff.pinLockedUntil = null;
    staff.pinMustChange = true;
    await this.staffRepository.save(staff);
  }
}
