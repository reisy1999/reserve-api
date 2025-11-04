import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DepartmentService } from './department.service';
import { AdminTokenGuard } from '../common/guards/admin-token.guard';
import {
  FindDepartmentsAdminDto,
  type PaginatedDepartmentsResponse,
  type DepartmentAdminResponse,
} from './dto/find-departments-admin.dto';

@Controller('admin/departments')
@UseGuards(AdminTokenGuard)
export class AdminDepartmentController {
  constructor(private readonly departmentService: DepartmentService) {}

  @Get()
  async findAll(
    @Query('limit') limitStr?: string,
    @Query('page') pageStr?: string,
    @Query('name') name?: string,
    @Query('active') activeStr?: string,
    @Query('sort') sort?: string,
    @Query('order') order?: string,
  ): Promise<PaginatedDepartmentsResponse> {
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
    const query: FindDepartmentsAdminDto = {
      limit,
      page,
      name,
      active,
      sort: sortValue as any,
      order: orderValue as any,
    };

    return this.departmentService.findAllForAdmin(query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<DepartmentAdminResponse> {
    return this.departmentService.findOneForAdmin(id);
  }
}
