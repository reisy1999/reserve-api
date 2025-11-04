import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StaffService } from './staff.service';
import { StaffController } from './staff.controller';
import { AdminStaffController } from './admin-staff.controller';
import { Staff } from './entities/staff.entity';
import { Department } from '../department/entities/department.entity';
import { AdminStaffTokenController } from './admin-staff-token.controller';
import { AdminTokenGuard } from '../common/guards/admin-token.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Staff, Department])],
  controllers: [
    StaffController,
    AdminStaffController,
    AdminStaffTokenController,
  ],
  providers: [StaffService, AdminTokenGuard],
  exports: [StaffService],
})
export class StaffModule {}
