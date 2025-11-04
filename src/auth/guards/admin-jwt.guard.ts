import {
  Injectable,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Staff } from '../../staff/entities/staff.entity';

interface RequestWithStaff {
  user: Staff;
}

@Injectable()
export class AdminJwtGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // まずJWT認証を実行
    const isAuthenticated = (await super.canActivate(context)) as boolean;
    if (!isAuthenticated) {
      return false;
    }

    // 認証成功後、管理者ロールをチェック
    const request = context.switchToHttp().getRequest<RequestWithStaff>();
    const user = request.user;

    if (user.role !== 'ADMIN') {
      throw new ForbiddenException('Forbidden resource');
    }

    return true;
  }
}
