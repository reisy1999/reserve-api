import {
  BadRequestException,
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
import type {
  AdminSlotQueryDto,
  PaginatedAdminSlotsResponse,
  AdminSlotResponse,
} from './dto/admin-slots.dto';
import type { UpdateSlotAdminDto } from './dto/update-slot-admin.dto';
import type {
  AdminReservationQueryDto,
  AdminReservationResponse,
  PaginatedAdminReservationsResponse,
} from './dto/admin-reservations.dto';
import type { FetchSlotsQueryDto } from './dto/fetch-slots.dto';

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

  private resolveCancelDeadline(slot: {
    cancelDeadlineDateLocal: string | null;
    cancelDeadlineMinuteOfDay: number | null;
  }): Date | null {
    if (
      !slot.cancelDeadlineDateLocal ||
      slot.cancelDeadlineMinuteOfDay === null ||
      slot.cancelDeadlineMinuteOfDay === undefined
    ) {
      return null;
    }

    const base = new Date(`${slot.cancelDeadlineDateLocal}T00:00:00+09:00`);
    if (Number.isNaN(base.getTime())) {
      return null;
    }
    const deadline = new Date(base.getTime());
    deadline.setMinutes(deadline.getMinutes() + slot.cancelDeadlineMinuteOfDay);
    return deadline;
  }

  private serializeSlot(slot: ReservationSlot): AdminSlotResponse {
    return {
      id: slot.id,
      reservationTypeId: slot.reservationTypeId,
      serviceDateLocal: slot.serviceDateLocal,
      startMinuteOfDay: slot.startMinuteOfDay,
      durationMinutes: slot.durationMinutes,
      capacity: slot.capacity,
      bookedCount: slot.bookedCount,
      status: slot.status,
      bookingStart: slot.bookingStart,
      bookingEnd: slot.bookingEnd,
      cancelDeadlineDateLocal: slot.cancelDeadlineDateLocal,
      cancelDeadlineMinuteOfDay: slot.cancelDeadlineMinuteOfDay,
      notes: slot.notes,
      updatedAt: slot.updatedAt,
    };
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
        canceledAt: IsNull(),
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
        if (message.includes('UQ_reservations_active_period')) {
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

  async cancelForStaff(staff: Staff, reservationId: number): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const reservationRepo = manager.getRepository(Reservation);
      const slotRepo = manager.getRepository(ReservationSlot);
      const supportsPessimisticLock = this.dataSource.options.type !== 'sqlite';

      const reservationFindOptions: FindOneOptions<Reservation> = {
        where: { id: reservationId, staffUid: staff.staffUid },
      };
      if (supportsPessimisticLock) {
        reservationFindOptions.lock = { mode: 'pessimistic_write' };
      }

      const reservation = await reservationRepo.findOne(reservationFindOptions);
      if (!reservation) {
        throw new NotFoundException('Reservation not found');
      }

      if (reservation.canceledAt) {
        return;
      }

      const slotFindOptions: FindOneOptions<ReservationSlot> = {
        where: { id: reservation.slotId },
      };
      if (supportsPessimisticLock) {
        slotFindOptions.lock = { mode: 'pessimistic_write' };
      }

      const slot = await slotRepo.findOne(slotFindOptions);
      if (!slot) {
        throw new NotFoundException('Reservation slot not found');
      }

      const deadline = this.resolveCancelDeadline(slot);
      if (deadline && Date.now() > deadline.getTime()) {
        throw new ConflictException('Cancellation deadline passed');
      }

      reservation.canceledAt = new Date();
      slot.bookedCount = Math.max(slot.bookedCount - 1, 0);

      await reservationRepo.save(reservation);
      await slotRepo.save(slot);
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
      capacityOverride:
        dto.capacityOverride !== undefined ? dto.capacityOverride : null,
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

  async findSlotsForAdmin(
    query: AdminSlotQueryDto,
  ): Promise<PaginatedAdminSlotsResponse> {
    const { page = 1, limit = 50 } = query;
    if (query.serviceDateFrom && query.serviceDateTo) {
      if (query.serviceDateFrom > query.serviceDateTo) {
        throw new BadRequestException(
          'serviceDateFrom must be before or equal to serviceDateTo',
        );
      }
    }

    const qb = this.slotRepository.createQueryBuilder('slot');

    if (query.reservationTypeId) {
      qb.andWhere('slot.reservationTypeId = :reservationTypeId', {
        reservationTypeId: query.reservationTypeId,
      });
    }
    if (query.status) {
      qb.andWhere('slot.status = :status', { status: query.status });
    }
    if (query.serviceDateFrom) {
      qb.andWhere('slot.serviceDateLocal >= :from', {
        from: query.serviceDateFrom,
      });
    }
    if (query.serviceDateTo) {
      qb.andWhere('slot.serviceDateLocal <= :to', {
        to: query.serviceDateTo,
      });
    }

    const normalizedOrder =
      (query.order ?? 'asc').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    const sortField = query.sort ?? 'serviceDateLocal';

    qb.orderBy(`slot.${sortField}`, normalizedOrder);
    qb.addOrderBy('slot.id', 'ASC');
    qb.skip((page - 1) * limit);
    qb.take(limit);

    const [slots, total] = await qb.getManyAndCount();

    return {
      data: slots.map((slot) => this.serializeSlot(slot)),
      meta: {
        total,
        page,
        limit,
      },
    };
  }

  async findSlotsForStaff(query: FetchSlotsQueryDto): Promise<ReservationSlot[]> {
    if (query.serviceDateFrom && query.serviceDateTo) {
      if (query.serviceDateFrom > query.serviceDateTo) {
        throw new BadRequestException(
          'serviceDateFrom must be before or equal to serviceDateTo',
        );
      }
    }

    const qb = this.slotRepository.createQueryBuilder('slot');

    // Filter by reservation type (required)
    qb.andWhere('slot.reservationTypeId = :reservationTypeId', {
      reservationTypeId: query.reservationTypeId,
    });

    // Security: Only show published slots to staff users by default
    // Allow filtering by status if explicitly provided
    const statusFilter = query.status ?? 'published';
    qb.andWhere('slot.status = :status', { status: statusFilter });

    // Filter by service date range
    if (query.serviceDateFrom) {
      qb.andWhere('slot.serviceDateLocal >= :from', {
        from: query.serviceDateFrom,
      });
    }
    if (query.serviceDateTo) {
      qb.andWhere('slot.serviceDateLocal <= :to', {
        to: query.serviceDateTo,
      });
    }

    // Filter by department if specified
    if (query.departmentId) {
      qb.leftJoin('slot.slotDepartments', 'slotDept')
        .andWhere('slotDept.departmentId = :departmentId', {
          departmentId: query.departmentId,
        });
    }

    // Order by service date and start time
    qb.orderBy('slot.serviceDateLocal', 'ASC');
    qb.addOrderBy('slot.startMinuteOfDay', 'ASC');
    qb.addOrderBy('slot.id', 'ASC');

    return qb.getMany();
  }

  private parseNullableDate(
    field: 'bookingStart' | 'bookingEnd',
    value: string | null | undefined,
  ): Date | null | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (value === null) {
      return null;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${field} must be a valid ISO date string`);
    }
    return parsed;
  }

  async updateSlotForAdmin(
    slotId: number,
    dto: UpdateSlotAdminDto,
  ): Promise<AdminSlotResponse> {
    const slot = await this.slotRepository.findOne({ where: { id: slotId } });
    if (!slot) {
      throw new NotFoundException('Reservation slot not found');
    }

    const cancelDateProvided = dto.cancelDeadlineDateLocal !== undefined;
    const cancelMinuteProvided = dto.cancelDeadlineMinuteOfDay !== undefined;
    if (cancelDateProvided !== cancelMinuteProvided) {
      throw new BadRequestException(
        'cancelDeadlineDateLocal and cancelDeadlineMinuteOfDay must be provided together',
      );
    }

    if (cancelDateProvided && cancelMinuteProvided) {
      const cancelDate = dto.cancelDeadlineDateLocal;
      const cancelMinute = dto.cancelDeadlineMinuteOfDay;
      if (
        (cancelDate === null && cancelMinute !== null) ||
        (cancelDate !== null && cancelMinute === null)
      ) {
        throw new BadRequestException(
          'Both cancel deadline fields must be null or non-null together',
        );
      }
      slot.cancelDeadlineDateLocal = cancelDate ?? null;
      slot.cancelDeadlineMinuteOfDay = cancelMinute ?? null;
    }

    if (dto.capacity !== undefined) {
      if (dto.capacity < 0) {
        throw new BadRequestException('capacity must be >= 0');
      }
      slot.capacity = dto.capacity;
      if (slot.bookedCount > slot.capacity) {
        slot.bookedCount = slot.capacity;
      }
    }

    if (dto.status !== undefined) {
      slot.status = dto.status;
    }

    if (dto.notes !== undefined) {
      slot.notes = dto.notes ?? null;
    }

    const bookingStart = this.parseNullableDate(
      'bookingStart',
      dto.bookingStart,
    );
    const bookingEnd = this.parseNullableDate('bookingEnd', dto.bookingEnd);

    if (bookingStart !== undefined) {
      slot.bookingStart = bookingStart;
    }
    if (bookingEnd !== undefined) {
      slot.bookingEnd = bookingEnd;
    }
    if (
      slot.bookingStart &&
      slot.bookingEnd &&
      slot.bookingStart.getTime() > slot.bookingEnd.getTime()
    ) {
      throw new BadRequestException(
        'bookingStart must be before or equal to bookingEnd',
      );
    }

    const saved = await this.slotRepository.save(slot);
    return this.serializeSlot(saved);
  }

  async findReservationsForAdmin(
    query: AdminReservationQueryDto,
  ): Promise<PaginatedAdminReservationsResponse> {
    if (query.serviceDateFrom && query.serviceDateTo) {
      if (query.serviceDateFrom > query.serviceDateTo) {
        throw new BadRequestException(
          'serviceDateFrom must be before or equal to serviceDateTo',
        );
      }
    }

    const { page = 1, limit = 50 } = query;

    const qb = this.reservationRepository
      .createQueryBuilder('reservation')
      .leftJoinAndSelect('reservation.staff', 'staff');

    if (query.staffId) {
      const trimmedStaffId = query.staffId.trim();
      if (trimmedStaffId) {
        qb.andWhere('reservation.staffId LIKE :staffId', {
          staffId: `%${trimmedStaffId}%`,
        });
      }
    }

    if (query.reservationTypeId) {
      qb.andWhere('reservation.reservationTypeId = :reservationTypeId', {
        reservationTypeId: query.reservationTypeId,
      });
    }

    if (query.status === 'active') {
      qb.andWhere('reservation.canceledAt IS NULL');
    } else if (query.status === 'canceled') {
      qb.andWhere('reservation.canceledAt IS NOT NULL');
    }

    if (query.serviceDateFrom) {
      qb.andWhere('reservation.serviceDateLocal >= :from', {
        from: query.serviceDateFrom,
      });
    }
    if (query.serviceDateTo) {
      qb.andWhere('reservation.serviceDateLocal <= :to', {
        to: query.serviceDateTo,
      });
    }

    const normalizedOrder =
      (query.order ?? 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const sortField = query.sort ?? 'updatedAt';

    qb.orderBy(`reservation.${sortField}`, normalizedOrder);
    qb.addOrderBy('reservation.id', 'ASC');
    qb.skip((page - 1) * limit);
    qb.take(limit);

    const [reservations, total] = await qb.getManyAndCount();

    const data: AdminReservationResponse[] = reservations.map(
      (reservation) => ({
        id: reservation.id,
        staffUid: reservation.staffUid,
        staffId: reservation.staffId,
        staffName: reservation.staff
          ? `${reservation.staff.familyName}${reservation.staff.givenName}`
          : reservation.staffId,
        departmentId: reservation.staff ? reservation.staff.departmentId : null,
        reservationTypeId: reservation.reservationTypeId,
        slotId: reservation.slotId,
        serviceDateLocal: reservation.serviceDateLocal,
        startMinuteOfDay: reservation.startMinuteOfDay,
        durationMinutes: reservation.durationMinutes,
        canceledAt: reservation.canceledAt,
        updatedAt: reservation.updatedAt,
      }),
    );

    return {
      data,
      meta: {
        total,
        page,
        limit,
      },
    };
  }

  async cancelReservationByAdmin(reservationId: number): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const reservationRepo = manager.getRepository(Reservation);
      const slotRepo = manager.getRepository(ReservationSlot);
      const supportsPessimisticLock = this.dataSource.options.type !== 'sqlite';

      const reservationFindOptions: FindOneOptions<Reservation> = {
        where: { id: reservationId },
      };
      if (supportsPessimisticLock) {
        reservationFindOptions.lock = { mode: 'pessimistic_write' };
      }

      const reservation = await reservationRepo.findOne(reservationFindOptions);
      if (!reservation) {
        return;
      }

      if (reservation.canceledAt) {
        return;
      }

      const slotFindOptions: FindOneOptions<ReservationSlot> = {
        where: { id: reservation.slotId },
      };
      if (supportsPessimisticLock) {
        slotFindOptions.lock = { mode: 'pessimistic_write' };
      }

      const slot = await slotRepo.findOne(slotFindOptions);
      reservation.canceledAt = new Date();

      if (slot) {
        slot.bookedCount = Math.max(slot.bookedCount - 1, 0);
        await slotRepo.save(slot);
      }

      await reservationRepo.save(reservation);
    });
  }
}
