import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { ReservationTypeService } from './reservation-type.service';
import { CreateReservationTypeDto } from './dto/create-reservation-type.dto';
import { UpdateReservationTypeDto } from './dto/update-reservation-type.dto';
import type { ReservationType } from './entities/reservation-type.entity';

@Controller('reservation-types')
export class ReservationTypeController {
  constructor(
    private readonly reservationTypeService: ReservationTypeService,
  ) {}

  @Post()
  create(
    @Body() createReservationTypeDto: CreateReservationTypeDto,
  ): Promise<ReservationType> {
    return this.reservationTypeService.create(createReservationTypeDto);
  }

  @Get()
  findAll(): Promise<ReservationType[]> {
    return this.reservationTypeService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<ReservationType> {
    return this.reservationTypeService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateReservationTypeDto: UpdateReservationTypeDto,
  ): Promise<ReservationType> {
    return this.reservationTypeService.update(+id, updateReservationTypeDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<void> {
    return this.reservationTypeService.remove(+id);
  }
}
