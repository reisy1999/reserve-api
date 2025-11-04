import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  type Repository,
  type FindOptionsWhere,
  type FindOptionsOrder,
  ILike,
} from 'typeorm';
import { Department } from './entities/department.entity';
import type {
  FindDepartmentsAdminDto,
  PaginatedDepartmentsResponse,
  DepartmentAdminResponse,
} from './dto/find-departments-admin.dto';

export interface DepartmentSummary {
  id: string;
  name: string;
}

@Injectable()
export class DepartmentService {
  constructor(
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,
  ) {}

  async findAllByActive(active: boolean): Promise<DepartmentSummary[]> {
    const departments = await this.departmentRepository.find({
      where: { active },
      order: { name: 'ASC' },
      select: ['id', 'name'],
    });

    return departments.map((department) => ({
      id: department.id,
      name: department.name,
    }));
  }

  async findAllForAdmin(
    query: FindDepartmentsAdminDto,
  ): Promise<PaginatedDepartmentsResponse> {
    const {
      limit = 50,
      page = 1,
      name,
      active,
      sort = 'id',
      order = 'asc',
    } = query;

    const where: FindOptionsWhere<Department> = {};

    if (name !== undefined) {
      where.name = ILike(`%${name.trim()}%`);
    }

    if (active !== undefined) {
      where.active = active;
    }

    // Get total count
    const total = await this.departmentRepository.count({ where });

    // Build order object with stable tie-break
    const orderObj: FindOptionsOrder<Department> = {
      [sort]: order.toUpperCase() as 'ASC' | 'DESC',
      id: 'ASC',
    };

    // Get paginated results
    const departments = await this.departmentRepository.find({
      where,
      order: orderObj,
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: departments.map((dept) => ({
        id: dept.id,
        name: dept.name,
        active: dept.active,
        createdAt: dept.createdAt,
        updatedAt: dept.updatedAt,
      })),
      meta: {
        total,
        page,
        limit,
      },
    };
  }

  async findOneForAdmin(id: string): Promise<DepartmentAdminResponse> {
    const department = await this.departmentRepository.findOne({
      where: { id },
    });

    if (!department) {
      throw new NotFoundException(`Department with id '${id}' not found`);
    }

    return {
      id: department.id,
      name: department.name,
      active: department.active,
      createdAt: department.createdAt,
      updatedAt: department.updatedAt,
    };
  }
}
