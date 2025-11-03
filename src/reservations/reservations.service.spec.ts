import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ReservationsService } from './reservations.service';
import { Reservation } from './entities/reservation.entity';
import { ReservationSlot } from './entities/reservation-slot.entity';
import { ReservationType } from '../reservation-type/entities/reservation-type.entity';
import type { Staff } from '../staff/entities/staff.entity';
import type { Department } from '../department/entities/department.entity';
import { calculatePeriodKey } from '../utils/date';

const createRepositoryMock = () => ({
  findOne: jest.fn(),
  findOneBy: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
});

const buildStaff = (overrides: Partial<Staff> = {}): Staff =>
  ({
    staffUid: 'staff-uid',
    staffId: 'staff-id',
    emrPatientId: '123',
    dateOfBirth: '2000-01-01',
    sexCode: '1',
    pinMustChange: false,
    pinHash: 'hashed',
    pinRetryCount: 0,
    pinLockedUntil: null,
    pinUpdatedAt: new Date(),
    pinVersion: 1,
    version: 1,
    familyName: 'Family',
    givenName: 'Given',
    familyNameKana: null,
    givenNameKana: null,
    jobTitle: 'Job',
    departmentId: 'dept-1',
    department: { id: 'dept-1' } as Department,
    status: 'active',
    role: 'STAFF',
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    refreshSessions: [],
    reservations: [],
    ...overrides,
  }) as Staff;

const buildSlot = (overrides: Partial<ReservationSlot> = {}): ReservationSlot =>
  ({
    id: 1,
    reservationTypeId: 10,
    reservationType: { id: 10 } as ReservationType,
    serviceDateLocal: '2024-05-01',
    startMinuteOfDay: 540,
    durationMinutes: 30,
    capacity: 5,
    bookedCount: 0,
    status: 'published',
    bookingStart: null,
    bookingEnd: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    reservations: [],
    ...overrides,
  }) as ReservationSlot;

describe('ReservationsService', () => {
  let service: ReservationsService;
  let reservationRepository: ReturnType<typeof createRepositoryMock>;
  let slotRepository: ReturnType<typeof createRepositoryMock>;
  let dataSource: { transaction: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservationsService,
        {
          provide: getRepositoryToken(Reservation),
          useValue: createRepositoryMock(),
        },
        {
          provide: getRepositoryToken(ReservationSlot),
          useValue: createRepositoryMock(),
        },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ReservationsService>(ReservationsService);
    reservationRepository = module.get<ReturnType<typeof createRepositoryMock>>(
      getRepositoryToken(Reservation),
    );
    slotRepository = module.get<ReturnType<typeof createRepositoryMock>>(
      getRepositoryToken(ReservationSlot),
    );
    dataSource = module.get(DataSource);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('rejects when staff must change their pin', async () => {
    const staff = buildStaff({ pinMustChange: true });

    await expect(service.createForStaff(staff, 1)).rejects.toThrow(
      'PIN change required before reserving.',
    );
    expect(slotRepository.findOne).not.toHaveBeenCalled();
  });

  it('rejects when staff profile is incomplete', async () => {
    const staff = buildStaff({ emrPatientId: null });

    await expect(service.createForStaff(staff, 1)).rejects.toThrow(
      'Profile incomplete for reservation.',
    );
    expect(slotRepository.findOne).not.toHaveBeenCalled();
  });

  it('throws when the reservation slot cannot be found', async () => {
    const staff = buildStaff();
    slotRepository.findOne.mockResolvedValue(null);

    await expect(service.createForStaff(staff, 1)).rejects.toThrow(
      'Reservation slot not found',
    );
    expect(slotRepository.findOne).toHaveBeenCalledWith({
      where: { id: 1 },
      relations: ['reservationType'],
    });
    expect(reservationRepository.findOne).not.toHaveBeenCalled();
  });

  it('throws when the booking window is closed', async () => {
    const staff = buildStaff();
    const slot = buildSlot({ status: 'draft' });
    slotRepository.findOne.mockResolvedValue(slot);

    await expect(service.createForStaff(staff, slot.id)).rejects.toThrow(
      'Reservation window closed',
    );
    expect(reservationRepository.findOne).not.toHaveBeenCalled();
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('throws when the staff already has a reservation for the period', async () => {
    const staff = buildStaff();
    const slot = buildSlot();
    slotRepository.findOne.mockResolvedValue(slot);
    reservationRepository.findOne.mockResolvedValue({} as Reservation);

    await expect(service.createForStaff(staff, slot.id)).rejects.toThrow(
      'Already reserved once in this fiscal year.',
    );
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('throws when the slot cannot be locked inside the transaction', async () => {
    const staff = buildStaff();
    const slot = buildSlot();
    slotRepository.findOne.mockResolvedValue(slot);
    reservationRepository.findOne.mockResolvedValue(null);

    const managerSlotRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn(),
    };
    const managerReservationRepo = {
      create: jest.fn(),
      save: jest.fn(),
    };
    const managerReservationTypeRepo = {
      findOneBy: jest.fn(),
    };
    const manager = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === ReservationSlot) return managerSlotRepo;
        if (entity === Reservation) return managerReservationRepo;
        if (entity === ReservationType) return managerReservationTypeRepo;
        throw new Error('Unexpected repository request');
      }),
    };

    dataSource.transaction.mockImplementation(async (callback) =>
      callback(manager as never),
    );

    await expect(service.createForStaff(staff, slot.id)).rejects.toThrow(
      'Reservation slot not found',
    );
    expect(managerSlotRepo.findOne).toHaveBeenCalled();
  });

  it('throws when reservation capacity has been reached', async () => {
    const staff = buildStaff();
    const slot = buildSlot();
    slotRepository.findOne.mockResolvedValue(slot);
    reservationRepository.findOne.mockResolvedValue(null);

    const lockedSlot = buildSlot({ id: slot.id, bookedCount: slot.capacity });
    const managerSlotRepo = {
      findOne: jest.fn().mockResolvedValue(lockedSlot),
      save: jest.fn(),
    };
    const managerReservationRepo = {
      create: jest.fn(),
      save: jest.fn(),
    };
    const managerReservationTypeRepo = {
      findOneBy: jest
        .fn()
        .mockResolvedValue({ id: slot.reservationTypeId } as ReservationType),
    };
    const manager = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === ReservationSlot) return managerSlotRepo;
        if (entity === Reservation) return managerReservationRepo;
        if (entity === ReservationType) return managerReservationTypeRepo;
        throw new Error('Unexpected repository request');
      }),
    };

    dataSource.transaction.mockImplementation(async (callback) =>
      callback(manager as never),
    );

    await expect(service.createForStaff(staff, slot.id)).rejects.toThrow(
      'Reservation capacity has been reached.',
    );
  });

  it('maps slot unique constraint violations to a conflict', async () => {
    const staff = buildStaff();
    const slot = buildSlot();
    slotRepository.findOne.mockResolvedValue(slot);
    reservationRepository.findOne.mockResolvedValue(null);

    const lockedSlot = buildSlot({ id: slot.id, bookedCount: 0 });
    const managerSlotRepo = {
      findOne: jest.fn().mockResolvedValue(lockedSlot),
      save: jest.fn().mockResolvedValue(lockedSlot),
    };
    const managerReservationRepo = {
      create: jest
        .fn()
        .mockImplementation(
          (data) => ({ ...(data as Record<string, unknown>) }) as Reservation,
        ),
      save: jest
        .fn()
        .mockRejectedValue(new Error('UQ_reservations_slot_staff')),
    };
    const managerReservationTypeRepo = {
      findOneBy: jest
        .fn()
        .mockResolvedValue({ id: slot.reservationTypeId } as ReservationType),
    };
    const manager = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === ReservationSlot) return managerSlotRepo;
        if (entity === Reservation) return managerReservationRepo;
        if (entity === ReservationType) return managerReservationTypeRepo;
        throw new Error('Unexpected repository request');
      }),
    };

    dataSource.transaction.mockImplementation(async (callback) =>
      callback(manager as never),
    );

    await expect(service.createForStaff(staff, slot.id)).rejects.toThrow(
      'Duplicate reservation for this slot.',
    );
    expect(managerReservationRepo.save).toHaveBeenCalled();
  });

  it('maps period unique constraint violations to a conflict', async () => {
    const staff = buildStaff();
    const slot = buildSlot();
    slotRepository.findOne.mockResolvedValue(slot);
    reservationRepository.findOne.mockResolvedValue(null);

    const lockedSlot = buildSlot({ id: slot.id, bookedCount: 0 });
    const managerSlotRepo = {
      findOne: jest.fn().mockResolvedValue(lockedSlot),
      save: jest.fn().mockResolvedValue(lockedSlot),
    };
    const managerReservationRepo = {
      create: jest
        .fn()
        .mockImplementation(
          (data) => ({ ...(data as Record<string, unknown>) }) as Reservation,
        ),
      save: jest
        .fn()
        .mockRejectedValue(new Error('UQ_reservations_staff_type_period')),
    };
    const managerReservationTypeRepo = {
      findOneBy: jest
        .fn()
        .mockResolvedValue({ id: slot.reservationTypeId } as ReservationType),
    };
    const manager = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === ReservationSlot) return managerSlotRepo;
        if (entity === Reservation) return managerReservationRepo;
        if (entity === ReservationType) return managerReservationTypeRepo;
        throw new Error('Unexpected repository request');
      }),
    };

    dataSource.transaction.mockImplementation(async (callback) =>
      callback(manager as never),
    );

    await expect(service.createForStaff(staff, slot.id)).rejects.toThrow(
      'Already reserved once in this fiscal year.',
    );
    expect(managerReservationRepo.save).toHaveBeenCalled();
  });

  it('creates a reservation when all conditions are satisfied', async () => {
    const staff = buildStaff();
    const slot = buildSlot({ bookedCount: 1 });
    slotRepository.findOne.mockResolvedValue(slot);
    reservationRepository.findOne.mockResolvedValue(null);
    const reservationType = { id: slot.reservationTypeId } as ReservationType;

    const lockedSlot = buildSlot({
      id: slot.id,
      bookedCount: slot.bookedCount,
    });
    const managerSlotRepo = {
      findOne: jest.fn().mockResolvedValue(lockedSlot),
      save: jest.fn().mockImplementation(async (entity) => entity),
    };
    const createdReservation = { id: 99 } as Reservation;
    const managerReservationRepo = {
      create: jest
        .fn()
        .mockImplementation(
          (data) => ({ ...(data as Record<string, unknown>) }) as Reservation,
        ),
      save: jest.fn().mockResolvedValue(createdReservation),
    };
    const managerReservationTypeRepo = {
      findOneBy: jest.fn().mockResolvedValue(reservationType),
    };
    const manager = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === ReservationSlot) return managerSlotRepo;
        if (entity === Reservation) return managerReservationRepo;
        if (entity === ReservationType) return managerReservationTypeRepo;
        throw new Error('Unexpected repository request');
      }),
    };

    dataSource.transaction.mockImplementation(async (callback) =>
      callback(manager as never),
    );

    const result = await service.createForStaff(staff, slot.id);

    const expectedPeriodKey = calculatePeriodKey(slot.serviceDateLocal);
    expect(reservationRepository.findOne).toHaveBeenCalledWith({
      where: {
        staffId: staff.staffId,
        reservationTypeId: slot.reservationTypeId,
        periodKey: expectedPeriodKey,
      },
    });
    expect(managerReservationTypeRepo.findOneBy).toHaveBeenCalledWith({
      id: slot.reservationTypeId,
    });
    expect(managerReservationRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        staffUid: staff.staffUid,
        staffId: staff.staffId,
        reservationTypeId: reservationType.id,
        slotId: lockedSlot.id,
        periodKey: expectedPeriodKey,
      }),
    );
    expect(managerReservationRepo.save).toHaveBeenCalled();
    expect(managerSlotRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ bookedCount: lockedSlot.bookedCount }),
    );
    expect(lockedSlot.bookedCount).toBe(slot.bookedCount + 1);
    expect(result).toBe(createdReservation);
  });
});
