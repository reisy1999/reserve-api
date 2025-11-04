import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { v4 as uuidv4 } from 'uuid';
import { StaffService, StaffImportPayload } from '../staff/staff.service';
import { ReservationType } from '../reservation-type/entities/reservation-type.entity';
import { ReservationSlot } from '../reservations/entities/reservation-slot.entity';

export interface ImportRowResult {
  rowNumber: number;
  staffId: string | null;
  status: 'created' | 'skippedExisting' | 'skippedInvalid' | 'duplicateInFile';
  reason?: string[];
}

export interface ImportSummary {
  created: number;
  skippedExisting: number;
  skippedInvalid: number;
  duplicateInFile: number;
  warnings: string[];
}

export interface ImportResponse {
  summary: ImportSummary;
  rows: ImportRowResult[];
  importBatchId?: string;
}

interface SlotInput {
  reservationTypeId: number;
  serviceDateLocal: string;
  startMinuteOfDay: number;
  durationMinutes: number;
  capacity: number;
  status: 'draft' | 'published' | 'closed';
  bookingStart?: string | null;
  bookingEnd?: string | null;
  notes?: string | null;
  cancelDeadlineDateLocal?: string | null;
  cancelDeadlineMinuteOfDay?: number | null;
}

@Injectable()
export class AdminService {
  constructor(
    private readonly staffService: StaffService,
    @InjectRepository(ReservationType)
    private readonly reservationTypeRepository: Repository<ReservationType>,
    @InjectRepository(ReservationSlot)
    private readonly reservationSlotRepository: Repository<ReservationSlot>,
  ) {}

  private normalizeCsv(input: string): string {
    return input?.toString()?.trim() ?? '';
  }

  private parseCsv(raw: string): Record<string, string>[] {
    const normalized = this.normalizeCsv(raw);
    if (!normalized) return [];
    const parsed: unknown = parse(normalized, {
      columns: true,
      skip_empty_lines: true,
      bom: true,
      trim: true,
    });
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter(
        (record): record is Record<string, unknown> =>
          typeof record === 'object' && record !== null,
      )
      .map((record) => {
        const result: Record<string, string> = {};
        for (const [key, value] of Object.entries(record)) {
          if (typeof value === 'string') {
            result[key] = value;
          } else if (value === null || value === undefined) {
            result[key] = '';
          } else if (typeof value === 'number' || typeof value === 'boolean') {
            result[key] = String(value);
          } else {
            try {
              result[key] = JSON.stringify(value);
            } catch {
              result[key] = '';
            }
          }
        }
        return result;
      });
  }

  async importStaffs(
    csvBody: string,
    dryRun: boolean,
  ): Promise<ImportResponse> {
    const records = this.parseCsv(csvBody);
    const summary: ImportSummary = {
      created: 0,
      skippedExisting: 0,
      skippedInvalid: 0,
      duplicateInFile: 0,
      warnings: [],
    };

    const requiredHeaders = ['名前(漢字)', '本部ID', '部署', '職種'];
    if (records.length === 0) {
      summary.warnings.push('CSV contained no importable rows.');
    }

    const seenCounts = new Map<string, number>();
    for (const record of records) {
      const staffId = (record['本部ID'] ?? '').trim();
      if (staffId) {
        seenCounts.set(staffId, (seenCounts.get(staffId) ?? 0) + 1);
      }
    }

    const rows: ImportRowResult[] = [];

    for (let index = 0; index < records.length; index += 1) {
      const rowNumber = index + 2; // header row assumed at 1
      const record = records[index];
      const reasons: string[] = [];

      for (const header of requiredHeaders) {
        if (!(header in record)) {
          reasons.push(`Missing column: ${header}`);
        }
      }

      const staffId = (record['本部ID'] ?? '').trim();
      const fullName = (record['名前(漢字)'] ?? '').trim();
      const departmentId = (record['部署'] ?? '').trim();
      const jobTitle = (record['職種'] ?? '').trim();

      if (!staffId) {
        reasons.push('staffId is required.');
      } else if (!/^\d+$/.test(staffId)) {
        reasons.push('staffId must be numeric.');
      }

      if (!fullName) {
        reasons.push('名前(漢字) is required.');
      }
      if (!departmentId) {
        reasons.push('部署 is required.');
      }

      let status: ImportRowResult['status'] = 'created';

      if (
        staffId &&
        seenCounts.get(staffId) &&
        (seenCounts.get(staffId) as number) > 1
      ) {
        status = 'duplicateInFile';
        reasons.push('Duplicate staffId within uploaded file.');
      }

      if (reasons.length > 0 && status === 'created') {
        status = 'skippedInvalid';
      }

      if (status === 'created') {
        const existing = await this.staffService.findByStaffId(staffId);
        if (existing) {
          status = 'skippedExisting';
        }
      }

      if (status === 'created' && !dryRun) {
        const payload: StaffImportPayload = {
          staffId,
          fullName,
          departmentId,
          jobTitle: jobTitle || '未設定',
        };
        await this.staffService.createFromImport(payload);
      }

      if (status === 'created') summary.created += 1;
      if (status === 'skippedExisting') summary.skippedExisting += 1;
      if (status === 'skippedInvalid') summary.skippedInvalid += 1;
      if (status === 'duplicateInFile') summary.duplicateInFile += 1;

      rows.push({
        rowNumber,
        staffId: staffId || null,
        status,
        reason: reasons.length > 0 ? reasons : undefined,
      });
    }

    const response: ImportResponse = {
      summary,
      rows,
    };

    if (!dryRun && rows.some((row) => row.status === 'created')) {
      response.importBatchId = uuidv4();
    }

    return response;
  }

  async createReservationType(
    payload: Partial<ReservationType>,
  ): Promise<ReservationType> {
    const entity = this.reservationTypeRepository.create({
      name: payload.name ?? '名称未設定',
      description: payload.description ?? null,
      active: payload.active ?? true,
    });
    return this.reservationTypeRepository.save(entity);
  }

  private toDateOrNull(field: string, value?: string | null): Date | null {
    if (value === undefined || value === null) return null;
    if (value === 'null' || value === 'undefined' || value === '') {
      return null;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(
        `${field} must be a valid ISO8601 date string`,
      );
    }
    return parsed;
  }

  private normalizeCancelDeadline(input: SlotInput): {
    cancelDeadlineDateLocal: string | null;
    cancelDeadlineMinuteOfDay: number | null;
  } {
    const dateProvided = input.cancelDeadlineDateLocal !== undefined;
    const minuteProvided = input.cancelDeadlineMinuteOfDay !== undefined;

    if (dateProvided !== minuteProvided) {
      throw new BadRequestException(
        'cancelDeadlineDateLocal and cancelDeadlineMinuteOfDay must be provided together',
      );
    }

    if (!dateProvided) {
      return {
        cancelDeadlineDateLocal: null,
        cancelDeadlineMinuteOfDay: null,
      };
    }

    const dateValue = input.cancelDeadlineDateLocal ?? null;
    const minuteValue = input.cancelDeadlineMinuteOfDay ?? null;

    if (
      (dateValue === null && minuteValue !== null) ||
      (dateValue !== null && minuteValue === null)
    ) {
      throw new BadRequestException(
        'Both cancel deadline fields must be null or non-null together',
      );
    }

    if (dateValue === null && minuteValue === null) {
      return {
        cancelDeadlineDateLocal: null,
        cancelDeadlineMinuteOfDay: null,
      };
    }

    if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(dateValue)) {
      throw new BadRequestException(
        'cancelDeadlineDateLocal must be formatted as YYYY-MM-DD',
      );
    }

    if (
      typeof minuteValue !== 'number' ||
      Number.isNaN(minuteValue) ||
      minuteValue < 0 ||
      minuteValue > 1439
    ) {
      throw new BadRequestException(
        'cancelDeadlineMinuteOfDay must be between 0 and 1439',
      );
    }

    return {
      cancelDeadlineDateLocal: dateValue,
      cancelDeadlineMinuteOfDay: minuteValue,
    };
  }

  async createSlots(
    inputs: SlotInput[],
  ): Promise<{ slots: ReservationSlot[] }> {
    const slots: ReservationSlot[] = [];
    for (const input of inputs) {
      const reservationType = await this.reservationTypeRepository.findOne({
        where: { id: input.reservationTypeId },
      });
      if (!reservationType) {
        throw new NotFoundException('Reservation type not found');
      }
      if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(input.serviceDateLocal)) {
        throw new BadRequestException(
          'serviceDateLocal must be formatted as YYYY-MM-DD',
        );
      }

      if (input.startMinuteOfDay < 0 || input.startMinuteOfDay > 1439) {
        throw new BadRequestException(
          'startMinuteOfDay must be between 0 and 1439',
        );
      }

      if (input.durationMinutes <= 0) {
        throw new BadRequestException('durationMinutes must be greater than 0');
      }

      if (input.capacity < 0) {
        throw new BadRequestException(
          'capacity must be greater than or equal to 0',
        );
      }

      const bookingStart = this.toDateOrNull(
        'bookingStart',
        input.bookingStart,
      );
      const bookingEnd = this.toDateOrNull('bookingEnd', input.bookingEnd);

      if (bookingStart && bookingEnd && bookingStart > bookingEnd) {
        throw new BadRequestException(
          'bookingStart must be before or equal to bookingEnd',
        );
      }

      const { cancelDeadlineDateLocal, cancelDeadlineMinuteOfDay } =
        this.normalizeCancelDeadline(input);

      const slot = this.reservationSlotRepository.create({
        reservationTypeId: reservationType.id,
        reservationType,
        serviceDateLocal: input.serviceDateLocal,
        startMinuteOfDay: input.startMinuteOfDay,
        durationMinutes: input.durationMinutes,
        capacity: input.capacity,
        bookedCount: 0,
        status: input.status ?? 'draft',
        bookingStart,
        bookingEnd,
        notes: input.notes ?? null,
        cancelDeadlineDateLocal,
        cancelDeadlineMinuteOfDay,
      });
      slots.push(await this.reservationSlotRepository.save(slot));
    }
    return { slots };
  }
}
