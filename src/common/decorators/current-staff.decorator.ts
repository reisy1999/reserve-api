import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { Staff } from '../../staff/entities/staff.entity';

export interface StaffRequest extends Request {
  user?: Staff;
}

export const CurrentStaff = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): Staff | undefined => {
    const request = ctx.switchToHttp().getRequest<StaffRequest>();
    return request.user;
  },
);
