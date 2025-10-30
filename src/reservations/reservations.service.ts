import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';

type Reservation = { id: number} & CreateReservationDto;

@Injectable()
export class ReservationsService {
  private seq = 1;
  private rows: Reservation[] = [];

  create(dto: CreateReservationDto): Reservation {
    const row = { id: this.seq++, ...dto };
    this.rows.push(row);
    return row;
  }

  findAll() {
    return `This action returns all reservations`;
  }

  findOne(id: number) {
    return `This action returns a #${id} reservation`;
  }

  update(id: number, updateReservationDto: UpdateReservationDto) {
    return `This action updates a #${id} reservation`;
  }

  remove(id: number) {
    return `This action removes a #${id} reservation`;
  }
}
