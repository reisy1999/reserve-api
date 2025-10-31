import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';

export type Reservation = { id: number } & CreateReservationDto;

@Injectable()
export class ReservationsService {
  private seq = 1;
  private rows: Reservation[] = [];

  //  予約新規作成
  create(dto: CreateReservationDto): Reservation {
    const row = { id: this.seq++, ...dto };
    this.rows.push(row);
    return row;
  }

  //  予約一覧検索
  findAll(): Reservation[] {
    return this.rows;
  }
  //  予約ID検索(findで一意性保証)
  findOne(id: number): Reservation {
    const hit = this.rows.find((r) => r.id === id);
    if (!hit) throw new NotFoundException();
    return hit;
  }
  //  予約条件検索
  findByField(field: keyof Reservation, value: string | number): Reservation[] {
    return this.rows.filter((r) => r[field] === value);
  }

  //  予約更新
  update(id: number, dto: UpdateReservationDto): Reservation {
    const i = this.rows.findIndex((r) => r.id === id);
    if (i < 0) throw new NotFoundException();
    this.rows[i] = { ...this.rows[i], ...dto };
    return this.rows[i];
  }

  //  予約削除
  remove(id: number): void {
    const i = this.rows.findIndex((r) => r.id === id);
    if (i < 0) throw new NotFoundException();
    this.rows.splice(i, 1);
  }
}
