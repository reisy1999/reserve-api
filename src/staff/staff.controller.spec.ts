import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';

const staffServiceMock = {
  findByStaffId: jest.fn(),
  findByStaffUid: jest.fn(),
  createFromImport: jest.fn(),
  updateProfile: jest.fn(),
  changePin: jest.fn(),
};

describe('StaffController', () => {
  let controller: StaffController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StaffController],
      providers: [
        {
          provide: StaffService,
          useValue: staffServiceMock,
        },
      ],
    }).compile();

    controller = module.get<StaffController>(StaffController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('updates the current staff profile and serializes the result', async () => {
    const staff = {
      staffUid: 'uid-1',
    } as any;
    const dto = { version: 1 };
    const updated = {
      staffUid: 'uid-1',
      staffId: 'staff-01',
      emrPatientId: '123',
      familyName: 'Family',
      givenName: 'Given',
      familyNameKana: 'FamKana',
      givenNameKana: 'GivKana',
      jobTitle: 'Job',
      departmentId: 'dept-1',
      dateOfBirth: '2000-01-01',
      sexCode: '1',
      pinMustChange: false,
      pinRetryCount: 2,
      pinLockedUntil: null,
      status: 'active',
      role: 'STAFF',
      version: 2,
      lastLoginAt: new Date('2024-01-01T00:00:00.000Z'),
      createdAt: new Date('2023-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-02T00:00:00.000Z'),
    } as any;
    staffServiceMock.updateProfile.mockResolvedValue(updated);

    const result = await controller.updateMe(staff, dto);

    expect(staffServiceMock.updateProfile).toHaveBeenCalledWith(staff, dto);
    expect(result).toEqual({
      staffUid: updated.staffUid,
      staffId: updated.staffId,
      emrPatientId: updated.emrPatientId,
      familyName: updated.familyName,
      givenName: updated.givenName,
      familyNameKana: updated.familyNameKana,
      givenNameKana: updated.givenNameKana,
      jobTitle: updated.jobTitle,
      departmentId: updated.departmentId,
      dateOfBirth: updated.dateOfBirth,
      sexCode: updated.sexCode,
      pinMustChange: updated.pinMustChange,
      pinRetryCount: updated.pinRetryCount,
      pinLockedUntil: updated.pinLockedUntil,
      status: updated.status,
      role: updated.role,
      version: updated.version,
      lastLoginAt: updated.lastLoginAt,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    });
  });

  it('changes the current staff pin', async () => {
    const staff = { staffUid: 'uid-1' } as any;
    const dto = { currentPin: '0000', newPin: '1234' };
    staffServiceMock.changePin.mockResolvedValue(undefined);

    await controller.changePin(staff, dto);

    expect(staffServiceMock.changePin).toHaveBeenCalledWith(
      staff,
      dto.currentPin,
      dto.newPin,
    );
  });
});
