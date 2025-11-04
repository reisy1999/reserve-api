import {
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository, type FindOneOptions } from 'typeorm';
import { Reservation } from './entities/reservation.entity';
import { ReservationSlot } from './entities/reservation-slot.entity';
import { ReservationSlotDepartment } from './entities/reservation-slot-department.entity';
import { ReservationType } from '../reservation-type/entities/reservation-type.entity';
import { Staff } from '../staff/entities/staff.entity';
import { Department } from '../department/entities/department.entity';
import { calculatePeriodKey } from '../utils/date';
import type {
  LinkDepartmentDto,
  UpdateSlotDepartmentDto,
  SlotDepartmentResponse,
} from './dto/slot-department.dto';

@Injectable()
export class ReservationsService {
  constructor(
    @InjectRepository(Reservation)
    private readonly reservationRepository: Repository<Reservation>,
    @InjectRepository(ReservationSlot)
    private readonly slotRepository: Repository<ReservationSlot>,
    @InjectRepository(ReservationSlotDepartment)
    private readonly slotDepartmentRepository: Repository<ReservationSlotDepartment>,
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,
    @InjectRepository(Staff)
    private readonly staffRepository: Repository<Staff>,
    private readonly dataSource: DataSource,
  ) {}

  private ensureStaffEligible(staff: Staff): void {
    if (staff.pinMustChange) {
      throw new HttpException('PIN change required before reserving.', 428);
    }
    if (!staff.emrPatientId || !staff.dateOfBirth || !staff.sexCode) {
      throw new HttpException('Profile incomplete for reservation.', 428);
    }
  }

  private isBookingWindowOpen(slot: ReservationSlot): boolean {
    const now = new Date();
    if (slot.status !== 'published') {
      return false;
    }
    const bookingStart = slot.bookingStart ? new Date(slot.bookingStart) : null;
    const bookingEnd = slot.bookingEnd ? new Date(slot.bookingEnd) : null;
    if (bookingStart && now < bookingStart) {
      return false;
    }
    if (bookingEnd && now > bookingEnd) {
      return false;
    }
    return true;
  }

  async createForStaff(staff: Staff, slotId: number): Promise<Reservation> {
    this.ensureStaffEligible(staff);

    const slot = await this.slotRepository.findOne({
      where: { id: slotId },
      relations: ['reservationType'],
    });
    if (!slot) {
      throw new NotFoundException('Reservation slot not found');
    }

    if (!this.isBookingWindowOpen(slot)) {
      throw new ForbiddenException('Reservation window closed');
    }

    const periodKey = calculatePeriodKey(slot.serviceDateLocal);

    const existing = await this.reservationRepository.findOne({
      where: {
        staffId: staff.staffId,
        reservationTypeId: slot.reservationTypeId,
        periodKey,
      },
    });
    if (existing) {
      throw new ConflictException('Already reserved once in this fiscal year.');
    }

    return this.dataSource.transaction(async (manager) => {
      const slotRepo = manager.getRepository(ReservationSlot);
      const reservationRepo = manager.getRepository(Reservation);

      const supportsPessimisticLock = this.dataSource.options.type !== 'sqlite';
      const slotFindOptions: FindOneOptions<ReservationSlot> = {
        where: { id: slotId },
      };
      if (supportsPessimisticLock) {
        slotFindOptions.lock = { mode: 'pessimistic_write' };
      }
      const lockedSlot = await slotRepo.findOne(slotFindOptions);

      if (!lockedSlot) {
        throw new NotFoundException('Reservation slot not found');
      }

      if (!this.isBookingWindowOpen(lockedSlot)) {
        throw new ForbiddenException('Reservation window closed');
      }

      if (lockedSlot.bookedCount >= lockedSlot.capacity) {
        throw new ConflictException('Reservation capacity has been reached.');
      }

      const reservationType = await manager
        .getRepository(ReservationType)
        .findOneBy({ id: lockedSlot.reservationTypeId });
      if (!reservationType) {
        throw new NotFoundException('Reservation type not found');
      }

      const reservation = reservationRepo.create({
        staffUid: staff.staffUid,
        staffId: staff.staffId,
        staff,
        reservationTypeId: reservationType.id,
        reservationType,
        slotId: lockedSlot.id,
        slot: lockedSlot,
        serviceDateLocal: lockedSlot.serviceDateLocal,
        startMinuteOfDay: lockedSlot.startMinuteOfDay,
        durationMinutes: lockedSlot.durationMinutes,
        periodKey,
        canceledAt: null,
      });

      lockedSlot.bookedCount += 1;
      await slotRepo.save(lockedSlot);

      try {
        return await reservationRepo.save(reservation);
      } catch (error: unknown) {
        let message: string;
        if (error instanceof Error) {
          message = error.message;
        } else if (typeof error === 'string') {
          message = error;
        } else {
          try {
            message = JSON.stringify(error);
          } catch {
            message = 'Unknown reservation error';
          }
        }
        if (message.includes('UQ_reservations_slot_staff')) {
          throw new ConflictException('Duplicate reservation for this slot.');
        }
        if (message.includes('UQ_reservations_staff_type_period')) {
          throw new ConflictException(
            'Already reserved once in this fiscal year.',
          );
        }
        throw error;
      }
    });
  }

  async findByStaffTypeAndPeriod(
    staffUid: string,
    reservationTypeId: number,
    periodKey: string,
  ): Promise<Reservation | null> {
    const staff = await this.staffRepository.findOne({
      where: { staffUid },
    });
    if (!staff) {
      throw new NotFoundException('Staff not found');
    }

    return this.reservationRepository.findOne({
      where: {
        staffId: staff.staffId,
        reservationTypeId,
        periodKey,
        canceledAt: IsNull(),
      },
      relations: ['reservationType', 'slot'],
    });
  }

  // Slot-Department CRUD operations

  async linkDepartmentToSlot(
    slotId: number,
    dto: LinkDepartmentDto,
  ): Promise<SlotDepartmentResponse> {
    // Verify slot exists
    const slot = await this.slotRepository.findOne({ where: { id: slotId } });
    if (!slot) {
      throw new NotFoundException(`Slot with id ${slotId} not found`);
    }

    // Verify department exists
    const department = await this.departmentRepository.findOne({
      where: { id: dto.departmentId },
    });
    if (!department) {
      throw new NotFoundException(
        `Department with id ${dto.departmentId} not found`,
      );
    }

    // Check for duplicate
    const existing = await this.slotDepartmentRepository.findOne({
      where: { slotId, departmentId: dto.departmentId },
    });
    if (existing) {
      throw new ConflictException(
        `Department ${dto.departmentId} is already linked to slot ${slotId}`,
      );
    }

    // Create link
    const link = this.slotDepartmentRepository.create({
      slotId,
      departmentId: dto.departmentId,
      enabled: dto.enabled !== undefined ? dto.enabled : true,
      capacityOverride: dto.capacityOverride !== undefined ? dto.capacityOverride : null,
    });

    const saved = await this.slotDepartmentRepository.save(link);

    return {
      id: saved.id,
      slotId: saved.slotId,
      departmentId: saved.departmentId,
      enabled: saved.enabled,
      capacityOverride: saved.capacityOverride,
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
    };
  }

  async updateSlotDepartment(
    slotId: number,
    departmentId: string,
    dto: UpdateSlotDepartmentDto,
  ): Promise<SlotDepartmentResponse> {
    const link = await this.slotDepartmentRepository.findOne({
      where: { slotId, departmentId },
    });

    if (!link) {
      throw new NotFoundException(
        `Link between slot ${slotId} and department ${departmentId} not found`,
      );
    }

    // Update fields
    if (dto.enabled !== undefined) {
      link.enabled = dto.enabled;
    }
    if (dto.capacityOverride !== undefined) {
      link.capacityOverride = dto.capacityOverride;
    }

    const saved = await this.slotDepartmentRepository.save(link);

    return {
      id: saved.id,
      slotId: saved.slotId,
      departmentId: saved.departmentId,
      enabled: saved.enabled,
      capacityOverride: saved.capacityOverride,
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
    };
  }

  async deleteSlotDepartment(
    slotId: number,
    departmentId: string,
  ): Promise<void> {
    // Idempotent delete - don't throw error if not found
    await this.slotDepartmentRepository.delete({ slotId, departmentId });
  }
}
