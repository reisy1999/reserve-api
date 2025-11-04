import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  type Repository,
  type FindOptionsWhere,
  type FindOptionsOrder,
  ILike,
} from 'typeorm';
import { CreateReservationTypeDto } from './dto/create-reservation-type.dto';
import { UpdateReservationTypeDto } from './dto/update-reservation-type.dto';
import { ReservationType } from './entities/reservation-type.entity';
import {
  type FindReservationTypesAdminDto,
  type PaginatedReservationTypesResponse,
  type ReservationTypeAdminResponse,
  mapToAdminResponse,
} from './dto/find-reservation-types-admin.dto';

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
    // Public API: return only active reservation types
    return this.repository.find({ where: { active: true } });
  }

  async findAllForAdmin(
    query: FindReservationTypesAdminDto,
  ): Promise<PaginatedReservationTypesResponse> {
    const {
      limit = 50,
      page = 1,
      name,
      active,
      sort = 'id',
      order = 'asc',
    } = query;

    const where: FindOptionsWhere<ReservationType> = {};

    if (name !== undefined) {
      where.name = ILike(`%${name.trim()}%`);
    }

    if (active !== undefined) {
      where.active = active;
    }

    // Get total count
    const total = await this.repository.count({ where });

    // Build order object with stable tie-break
    const orderObj: FindOptionsOrder<ReservationType> = {
      [sort]: order.toUpperCase() as 'ASC' | 'DESC',
      id: 'ASC',
    };

    // Get paginated results
    const reservationTypes = await this.repository.find({
      where,
      order: orderObj,
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: reservationTypes.map(mapToAdminResponse),
      meta: {
        total,
        page,
        limit,
      },
    };
  }

  async findOneForAdmin(id: number): Promise<ReservationTypeAdminResponse> {
    const entity = await this.repository.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException('Reservation type not found');
    }
    return mapToAdminResponse(entity);
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
