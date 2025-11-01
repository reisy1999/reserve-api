import { Injectable } from '@nestjs/common';
import { CreateReservationTypeDto } from './dto/create-reservation-type.dto';
import { UpdateReservationTypeDto } from './dto/update-reservation-type.dto';

@Injectable()
export class ReservationTypeService {
  create(createReservationTypeDto: CreateReservationTypeDto) {
    return 'This action adds a new reservationType';
  }

  findAll() {
    return `This action returns all reservationType`;
  }

  findOne(id: number) {
    return `This action returns a #${id} reservationType`;
  }

  update(id: number, updateReservationTypeDto: UpdateReservationTypeDto) {
    return `This action updates a #${id} reservationType`;
  }

  remove(id: number) {
    return `This action removes a #${id} reservationType`;
  }
}
