import { Injectable } from '@nestjs/common';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@Injectable()
export class DepartmentService {
  create(_createDepartmentDto: CreateDepartmentDto): string {
    return 'This action adds a new department';
  }

  findAll(): string {
    return `This action returns all department`;
  }

  findOne(id: number): string {
    return `This action returns a #${id} department`;
  }

  update(id: number, _updateDepartmentDto: UpdateDepartmentDto): string {
    return `This action updates a #${id} department`;
  }

  remove(id: number): string {
    return `This action removes a #${id} department`;
  }
}
