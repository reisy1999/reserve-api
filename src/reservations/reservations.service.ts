import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Reservation } from './entities/reservation.entity';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';

@Injectable()
export class ReservationsService {
  constructor(
    @InjectRepository(Reservation)
    private readonly repo: Repository<Reservation>,
  ) {}

  // 予約作成
  async create(dto: CreateReservationDto): Promise<Reservation> {
    const entity = this.repo.create(dto);
    return await this.repo.save(entity);
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

  // ユースケース別検索例：職員IDと日付で取得
  async findByStaffAndDate(
    staffId: number,
    serviceDateLocal: string,
  ): Promise<Reservation[]> {
    return await this.repo.find({
      where: { staffId, serviceDateLocal },
      order: { startMinuteOfDay: 'ASC' },
    });
  }
}
