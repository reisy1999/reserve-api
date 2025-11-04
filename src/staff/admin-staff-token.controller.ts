import {
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { StaffService } from './staff.service';
import { AdminTokenGuard } from '../common/guards/admin-token.guard';
import {
  FindStaffsAdminDto,
  type PaginatedStaffAdminResponse,
} from './dto/find-staffs-admin.dto';

@Controller('admin/staffs')
@UseGuards(AdminTokenGuard)
export class AdminStaffTokenController {
  constructor(private readonly staffService: StaffService) {}

  @Get()
  async listStaffs(
    @Query() query: FindStaffsAdminDto,
  ): Promise<PaginatedStaffAdminResponse> {
    return this.staffService.findAllForAdmin(query);
  }

  @Post(':staffUid/unlock')
  @HttpCode(204)
  async unlockStaff(@Param('staffUid') staffUid: string): Promise<void> {
    await this.staffService.unlockPin(staffUid);
  }
}
