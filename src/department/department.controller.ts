import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { DepartmentService, type DepartmentSummary } from './department.service';

@Controller('departments')
export class DepartmentController {
  constructor(private readonly departmentService: DepartmentService) {}

  @Get()
  async findAll(
    @Query('active') active?: string,
  ): Promise<DepartmentSummary[]> {
    if (active === undefined || active === 'true') {
      return this.departmentService.findAllByActive(true);
    }
    if (active === 'false') {
      return this.departmentService.findAllByActive(false);
    }

    throw new BadRequestException(
      "Query parameter 'active' must be 'true' or 'false' when provided.",
    );
  }
}
