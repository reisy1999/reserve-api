import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';

type Reservation = { id: number } & CreateReservationDto;

@Injectable()
export class ReservationsService {
  private seq = 1;
  private rows: Reservation[] = [];

 create(dto: CreateReservationDto): Reservation {
    const row = { id: this.seq++, ...dto };
    this.rows.push(row);
    return row;
  }
 
  findAll(): Reservation[] { return this.rows; }
  findOne(id: number): Reservation {
    const hit = this.rows.find(r => r.id === id);
    if (!hit) throw new NotFoundException();
    return hit;
  }
  findByField(field: keyof Reservation, value: string | number): Reservation[] {
    return this.rows.filter(r => r[field] === value);
  }

  update(id: number, dto: UpdateReservationDto): Reservation {
    const i = this.rows.findIndex(r => r.id === id);
    if (i < 0) throw new NotFoundException();
    this.rows[i] = { ...this.rows[i], ...dto };
    return this.rows[i];
  }
  remove(id: number): void {
    const i = this.rows.findIndex(r => r.id === id);
    if (i < 0) throw new NotFoundException();
    this.rows.splice(i, 1);
  }
}

