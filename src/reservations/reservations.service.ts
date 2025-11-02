import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Reservation } from './entities/reservation.entity';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { calculatePeriodKey } from '../utils/date';

@Injectable()
export class ReservationsService {
  constructor(
    @InjectRepository(Reservation)
    private readonly repo: Repository<Reservation>,
  ) {}

  // 予約作成
  async create(dto: CreateReservationDto): Promise<Reservation> {
    const periodKey = calculatePeriodKey(dto.serviceDateLocal);
    // 一意性のチェック
    const dup = await this.repo.count({
      where: {
        staffId: dto.staffId as string,
        reservationTypeId: dto.reservationTypeId,
        periodKey,
      },
    });
    if (dup > 0) {
      throw new ConflictException('Already reserved once in this fiscal year,');
    }

    const entity = this.repo.create({ ...dto, periodKey });
    try {
      return await this.repo.save(entity);
    } catch (err: any) {
      // DBのユニーク制約に引っかかった場合のフォールバック（同時実行など）
      const msg = String(err?.message ?? '');
      if (msg.includes('UNIQUE') || msg.includes('SQLITE_CONSTRAINT')) {
        throw new ConflictException(
          'Already reserved once in this fiscal year.',
        );
      }
      throw err;
    }
  }

  // 全件取得（デフォルト並び：日付＋開始時間）
  async findAll(): Promise<Reservation[]> {
    return await this.repo.find({
      order: {
        serviceDateLocal: 'ASC',
        startMinuteOfDay: 'ASC',
      },
    });
  }

  // 単件取得（存在しなければ404）
  async findOne(id: number): Promise<Reservation> {
    const hit = await this.repo.findOneBy({ id });
    if (!hit) throw new NotFoundException(`Reservation #${id} not found`);
    return hit;
  }

  // 更新（部分更新）
  async update(id: number, dto: UpdateReservationDto): Promise<Reservation> {
    const hit = await this.findOne(id);
    const merged = this.repo.merge(hit, dto);
    return await this.repo.save(merged);
  }

  // 削除（存在しなければ404）
  async remove(id: number): Promise<void> {
    const hit = await this.findOne(id);
    await this.repo.remove(hit);
  }

  // 職員×年度×種別 検索（年度1回制チェック用）
  async findByStaffTypePeriod(
    staffId: string,
    reservationTypeId: number,
    periodKey: string,
  ): Promise<Reservation | null> {
    return await this.repo.findOne({
      where: { staffId, reservationTypeId, periodKey },
    });
  }
}
