import type { Request } from 'express';
import type { Staff } from '../../staff/entities/staff.entity';

export interface RequestWithStaff extends Request {
  user: Staff;
}
