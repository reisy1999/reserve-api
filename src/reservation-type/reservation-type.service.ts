import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateReservationTypeDto } from './dto/create-reservation-type.dto';
import { UpdateReservationTypeDto } from './dto/update-reservation-type.dto';
import { ReservationType } from './entities/reservation-type.entity';

@Injectable()
export class ReservationTypeService {
  constructor(
    @InjectRepository(ReservationType)
    private readonly repository: Repository<ReservationType>,
  ) {}

  create(dto: CreateReservationTypeDto): Promise<ReservationType> {
    const entity = this.repository.create({
      name: dto.name,
      description: dto.description ?? null,
      active: dto.active ?? true,
    });
    return this.repository.save(entity);
  }

  findAll(): Promise<ReservationType[]> {
    return this.repository.find();
  }

  async findOne(id: number): Promise<ReservationType> {
    const entity = await this.repository.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('Reservation type not found');
    return entity;
  }

  async update(
    id: number,
    dto: UpdateReservationTypeDto,
  ): Promise<ReservationType> {
    const entity = await this.findOne(id);
    Object.assign(entity, dto);
    return this.repository.save(entity);
  }

  async remove(id: number): Promise<void> {
    const entity = await this.findOne(id);
    await this.repository.remove(entity);
  }
}
