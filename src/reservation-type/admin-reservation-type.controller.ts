import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { ReservationTypeService } from './reservation-type.service';
import { CreateReservationTypeDto } from './dto/create-reservation-type.dto';
import { UpdateReservationTypeDto } from './dto/update-reservation-type.dto';
import { AdminTokenGuard } from '../common/guards/admin-token.guard';
import type { ReservationType } from './entities/reservation-type.entity';
import type {
  FindReservationTypesAdminDto,
  PaginatedReservationTypesResponse,
  ReservationTypeAdminResponse,
} from './dto/find-reservation-types-admin.dto';

@Controller('admin/reservation-types')
@UseGuards(AdminTokenGuard)
export class AdminReservationTypeController {
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
  async findAll(
    @Query('limit') limitStr?: string,
    @Query('page') pageStr?: string,
    @Query('name') name?: string,
    @Query('active') activeStr?: string,
    @Query('sort') sort?: string,
    @Query('order') order?: string,
  ): Promise<PaginatedReservationTypesResponse> {
    // Parse and validate limit
    const limit = limitStr ? parseInt(limitStr, 10) : 50;
    if (limit > 100) {
      throw new BadRequestException('limit must not be greater than 100');
    }
    if (limit < 1) {
      throw new BadRequestException('limit must not be less than 1');
    }

    // Parse and validate page
    const page = pageStr ? parseInt(pageStr, 10) : 1;
    if (page < 1) {
      throw new BadRequestException('page must not be less than 1');
    }

    // Parse active
    const active =
      activeStr === 'true'
        ? true
        : activeStr === 'false'
          ? false
          : undefined;

    // Validate sort and order
    const validSorts = ['id', 'name', 'updatedAt'];
    const sortValue = sort && validSorts.includes(sort) ? sort : 'id';

    const validOrders = ['asc', 'desc'];
    const orderValue = order && validOrders.includes(order) ? order : 'asc';

    // Build query DTO
    const query: FindReservationTypesAdminDto = {
      limit,
      page,
      name,
      active,
      sort: sortValue as any,
      order: orderValue as any,
    };

    return this.reservationTypeService.findAllForAdmin(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<ReservationTypeAdminResponse> {
    return this.reservationTypeService.findOneForAdmin(+id);
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
