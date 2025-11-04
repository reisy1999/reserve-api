import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DepartmentService } from './department.service';
import { DepartmentController } from './department.controller';
import { AdminDepartmentController } from './admin-department.controller';
import { Department } from './entities/department.entity';
import { AdminTokenGuard } from '../common/guards/admin-token.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Department])],
  controllers: [DepartmentController, AdminDepartmentController],
  providers: [DepartmentService, AdminTokenGuard],
})
export class DepartmentModule {}
