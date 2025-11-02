import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  ParseIntPipe,
} from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { Reservation } from './entities/reservation.entity';

@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  // 新規作成
  @Post()
  async create(@Body() dto: CreateReservationDto): Promise<Reservation> {
    return this.reservationsService.create(dto);
  }

  // 全件検索
  @Get()
  async findAll(): Promise<Reservation[]> {
    return this.reservationsService.findAll();
  }

  // id検索(一意)
  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Reservation> {
    return this.reservationsService.findOne(id);
  }

  // 更新
  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateReservationDto,
  ): Promise<Reservation> {
    return this.reservationsService.update(id, dto);
  }

  // 削除
  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.reservationsService.remove(id);
  }

  // 年度内対象予約における一意性検索staffId=&reservationTypeId=&periodKey
  @Get('search')
  async findByStaffTypePeriod(
    @Query('staffId') staffId: string,
    @Query('reservationTypeId', ParseIntPipe) reservationTypeId: number,
    @Query('periodKey') periodKey: string,
  ): Promise<Reservation | null> {
    return this.reservationsService.findByStaffTypePeriod(
      staffId,
      reservationTypeId,
      periodKey,
    );
  }
}
