import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import { AdminTokenGuard } from '../common/guards/admin-token.guard';
import {
  LinkDepartmentDto,
  UpdateSlotDepartmentDto,
  type SlotDepartmentResponse,
} from './dto/slot-department.dto';

@Controller('admin/slots')
@UseGuards(AdminTokenGuard)
export class AdminSlotsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Post(':id/departments')
  async linkDepartment(
    @Param('id', ParseIntPipe) slotId: number,
    @Body() dto: LinkDepartmentDto,
  ): Promise<SlotDepartmentResponse> {
    return this.reservationsService.linkDepartmentToSlot(slotId, dto);
  }

  @Patch(':slotId/departments/:deptId')
  async updateSlotDepartment(
    @Param('slotId', ParseIntPipe) slotId: number,
    @Param('deptId') departmentId: string,
    @Body() dto: UpdateSlotDepartmentDto,
  ): Promise<SlotDepartmentResponse> {
    return this.reservationsService.updateSlotDepartment(
      slotId,
      departmentId,
      dto,
    );
  }

  @Delete(':slotId/departments/:deptId')
  @HttpCode(204)
  async deleteSlotDepartment(
    @Param('slotId', ParseIntPipe) slotId: number,
    @Param('deptId') departmentId: string,
  ): Promise<void> {
    await this.reservationsService.deleteSlotDepartment(slotId, departmentId);
  }
}
