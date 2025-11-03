import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  StaffService,
  type StaffImportPayload,
  type UpdateProfilePayload,
} from './staff.service';
import { Staff } from './entities/staff.entity';
import { Department } from '../department/entities/department.entity';
import { SecurityService } from '../security/security.service';

const createRepositoryMock = () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
});

const securityServiceMock: jest.Mocked<
  Pick<SecurityService, 'hash' | 'verify'>
> = {
  hash: jest.fn(),
  verify: jest.fn(),
};

const buildStaff = (overrides: Partial<Staff> = {}): Staff =>
  ({
    staffUid: 'staff-uid',
    staffId: 'staff-id',
    emrPatientId: '123',
    familyName: 'Family',
    givenName: 'Given',
    familyNameKana: null,
    givenNameKana: null,
    jobTitle: 'Job',
    departmentId: 'dept-1',
    department: { id: 'dept-1' } as Department,
    dateOfBirth: '2000-01-01',
    sexCode: '1',
    pinHash: 'hashed',
    pinRetryCount: 0,
    pinLockedUntil: null,
    pinUpdatedAt: new Date(),
    pinVersion: 1,
    pinMustChange: false,
    version: 1,
    status: 'active',
    role: 'STAFF',
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    refreshSessions: [],
    reservations: [],
    ...overrides,
  }) as Staff;

describe('StaffService', () => {
  let service: StaffService;
  let staffRepository: ReturnType<typeof createRepositoryMock>;
  let departmentRepository: ReturnType<typeof createRepositoryMock>;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StaffService,
        {
          provide: getRepositoryToken(Staff),
          useValue: createRepositoryMock(),
        },
        {
          provide: getRepositoryToken(Department),
          useValue: createRepositoryMock(),
        },
        {
          provide: SecurityService,
          useValue: securityServiceMock,
        },
      ],
    }).compile();

    service = module.get<StaffService>(StaffService);
    staffRepository = module.get<ReturnType<typeof createRepositoryMock>>(
      getRepositoryToken(Staff),
    );
    departmentRepository = module.get<ReturnType<typeof createRepositoryMock>>(
      getRepositoryToken(Department),
    );

    staffRepository.save.mockImplementation(async (entity) => entity);
    staffRepository.create.mockImplementation(
      (data) => ({ ...(data as Record<string, unknown>) }) as Staff,
    );
    departmentRepository.save.mockImplementation(async (entity) => entity);
    departmentRepository.create.mockImplementation(
      (data) => ({ ...(data as Record<string, unknown>) }) as Department,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns existing department when ensureDepartment finds one', async () => {
    const department = { id: 'dept-1' } as Department;
    departmentRepository.findOne.mockResolvedValue(department);

    const result = await service.ensureDepartment(' dept-1 ', 'Dept Name');

    expect(departmentRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'dept-1' },
    });
    expect(result).toBe(department);
    expect(departmentRepository.create).not.toHaveBeenCalled();
  });

  it('creates a department when ensureDepartment cannot find one', async () => {
    departmentRepository.findOne.mockResolvedValue(null);
    const created = {
      id: 'dept-1',
      name: 'dept-1',
      active: true,
    } as Department;
    departmentRepository.create.mockReturnValue(created);

    const result = await service.ensureDepartment('dept-1');

    expect(departmentRepository.create).toHaveBeenCalledWith({
      id: 'dept-1',
      name: 'dept-1',
      active: true,
    });
    expect(departmentRepository.save).toHaveBeenCalledWith(created);
    expect(result).toBe(created);
  });

  it('creates staff from import payload', async () => {
    const payload: StaffImportPayload = {
      staffId: 'staff-001',
      fullName: 'Jane Doe',
      departmentId: 'dept-99',
      jobTitle: 'Nurse',
    };
    const department = { id: payload.departmentId } as Department;
    const ensureDepartmentSpy = jest
      .spyOn(service, 'ensureDepartment')
      .mockResolvedValue(department);
    securityServiceMock.hash.mockResolvedValue('hashed-pin');
    const createdStaff = buildStaff({
      staffId: payload.staffId,
      familyName: payload.fullName,
      givenName: payload.fullName,
      jobTitle: payload.jobTitle,
      department,
      departmentId: department.id,
      emrPatientId: null,
      pinMustChange: true,
    });
    staffRepository.create.mockReturnValue(createdStaff);
    staffRepository.save.mockResolvedValue(createdStaff);

    const result = await service.createFromImport(payload);

    expect(ensureDepartmentSpy).toHaveBeenCalledWith(payload.departmentId);
    expect(securityServiceMock.hash).toHaveBeenCalledWith('0000');
    expect(staffRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        staffId: payload.staffId,
        department,
        departmentId: department.id,
        pinMustChange: true,
      }),
    );
    expect(staffRepository.save).toHaveBeenCalledWith(createdStaff);
    expect(result).toBe(createdStaff);
    ensureDepartmentSpy.mockRestore();
  });

  it('increments failed pin attempts and locks after max retries', async () => {
    const staff = buildStaff({ pinRetryCount: 4 });

    const result = await service.incrementFailedPin(staff);

    expect(staff.pinRetryCount).toBe(5);
    expect(staff.pinLockedUntil).toBeInstanceOf(Date);
    expect(staffRepository.save).toHaveBeenCalledWith(staff);
    expect(result).toBe(staff);
  });

  it('increments failed pin attempts without locking before max retries', async () => {
    const staff = buildStaff({ pinRetryCount: 1, pinLockedUntil: null });

    await service.incrementFailedPin(staff);

    expect(staff.pinRetryCount).toBe(2);
    expect(staff.pinLockedUntil).toBeNull();
  });

  it('resets pin failures', async () => {
    const staff = buildStaff({ pinRetryCount: 3, pinLockedUntil: new Date() });

    await service.resetPinFailures(staff);

    expect(staff.pinRetryCount).toBe(0);
    expect(staff.pinLockedUntil).toBeNull();
    expect(staffRepository.save).toHaveBeenCalledWith(staff);
  });

  it('records successful login', async () => {
    const staff = buildStaff({ lastLoginAt: null });

    await service.recordSuccessfulLogin(staff);

    expect(staff.lastLoginAt).toBeInstanceOf(Date);
    expect(staffRepository.save).toHaveBeenCalledWith(staff);
  });

  it('updates status', async () => {
    const staff = buildStaff({ status: 'active' });

    await service.updateStatus(staff, 'suspended');

    expect(staff.status).toBe('suspended');
    expect(staffRepository.save).toHaveBeenCalledWith(staff);
  });

  it('throws when versions mismatch on updateProfile', async () => {
    const staff = buildStaff({ version: 2 });
    const payload: UpdateProfilePayload = {
      version: 1,
    };

    await expect(service.updateProfile(staff, payload)).rejects.toThrow(
      'Version mismatch',
    );
    expect(staffRepository.save).not.toHaveBeenCalled();
  });

  it('requires current pin when sensitive fields change', async () => {
    const staff = buildStaff();

    await expect(
      service.updateProfile(staff, {
        version: staff.version,
        emrPatientId: '456',
      }),
    ).rejects.toThrow('PIN re-authentication required');
  });

  it('throws when current pin verification fails during updateProfile', async () => {
    const staff = buildStaff();
    securityServiceMock.verify.mockResolvedValue(false);

    await expect(
      service.updateProfile(staff, {
        version: staff.version,
        currentPin: '0000',
        emrPatientId: '456',
      }),
    ).rejects.toThrow('PIN mismatch');
    expect(securityServiceMock.verify).toHaveBeenCalledWith(
      '0000',
      staff.pinHash,
    );
  });

  it('validates emrPatientId format', async () => {
    const staff = buildStaff();
    securityServiceMock.verify.mockResolvedValue(true);

    await expect(
      service.updateProfile(staff, {
        version: staff.version,
        currentPin: '0000',
        emrPatientId: 'abc',
      }),
    ).rejects.toThrow('emrPatientId must be numeric');
    expect(staffRepository.findOne).not.toHaveBeenCalled();
  });

  it('prevents duplicate emrPatientId assignments', async () => {
    const staff = buildStaff({ staffUid: 'staff-uid' });
    const other = buildStaff({ staffUid: 'other-uid' });
    securityServiceMock.verify.mockResolvedValue(true);
    staffRepository.findOne.mockResolvedValue(other);

    await expect(
      service.updateProfile(staff, {
        version: staff.version,
        currentPin: '0000',
        emrPatientId: other.emrPatientId ?? '123',
      }),
    ).rejects.toThrow('emrPatientId already exists.');
  });

  it('updates profile fields and bumps version', async () => {
    const staff = buildStaff({ version: 3, emrPatientId: null });
    securityServiceMock.verify.mockResolvedValue(true);
    staffRepository.findOne.mockResolvedValue(null);
    const payload: UpdateProfilePayload = {
      version: 3,
      currentPin: '0000',
      emrPatientId: '999',
      dateOfBirth: '1991-04-05',
      sexCode: '2',
      familyNameKana: 'family-kana',
      givenNameKana: 'given-kana',
      jobTitle: 'Doctor',
    };

    const result = await service.updateProfile(staff, payload);

    expect(staff.emrPatientId).toBe('999');
    expect(staff.dateOfBirth).toBe('1991-04-05');
    expect(staff.sexCode).toBe('2');
    expect(staff.familyNameKana).toBe('family-kana');
    expect(staff.givenNameKana).toBe('given-kana');
    expect(staff.jobTitle).toBe('Doctor');
    expect(staff.version).toBe(4);
    expect(staffRepository.save).toHaveBeenCalledWith(staff);
    expect(result).toBe(staff);
  });

  it('throws when changing pin with invalid current pin', async () => {
    const staff = buildStaff();
    securityServiceMock.verify.mockResolvedValue(false);

    await expect(service.changePin(staff, '0000', '1111')).rejects.toThrow(
      'Current PIN is invalid',
    );
  });

  it('validates new pin format', async () => {
    const staff = buildStaff();
    securityServiceMock.verify.mockResolvedValue(true);

    await expect(service.changePin(staff, '0000', '12')).rejects.toThrow(
      'PIN must be 4 digits',
    );
  });

  it('changes pin and resets related state', async () => {
    const staff = buildStaff({
      pinRetryCount: 3,
      pinLockedUntil: new Date(),
      pinMustChange: true,
      pinVersion: 1,
    });
    securityServiceMock.verify.mockResolvedValue(true);
    securityServiceMock.hash.mockResolvedValue('new-hash');

    await service.changePin(staff, '0000', '1234');

    expect(staff.pinHash).toBe('new-hash');
    expect(staff.pinMustChange).toBe(false);
    expect(staff.pinRetryCount).toBe(0);
    expect(staff.pinLockedUntil).toBeNull();
    expect(staff.pinVersion).toBe(2);
    expect(staff.pinUpdatedAt).toBeInstanceOf(Date);
    expect(staffRepository.save).toHaveBeenCalledWith(staff);
  });
});
