import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ReservationTypeService } from './reservation-type.service';
import { CreateReservationTypeDto } from './dto/create-reservation-type.dto';
import { UpdateReservationTypeDto } from './dto/update-reservation-type.dto';

@Controller('reservation-type')
export class ReservationTypeController {
  constructor(private readonly reservationTypeService: ReservationTypeService) {}

  @Post()
  create(@Body() createReservationTypeDto: CreateReservationTypeDto) {
    return this.reservationTypeService.create(createReservationTypeDto);
  }

  @Get()
  findAll() {
    return this.reservationTypeService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.reservationTypeService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateReservationTypeDto: UpdateReservationTypeDto) {
    return this.reservationTypeService.update(+id, updateReservationTypeDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.reservationTypeService.remove(+id);
  }
}
