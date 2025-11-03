import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class AdminTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const headerToken = request.headers['x-admin-token'] as string | undefined;
    const expectedToken = process.env.ADMIN_TOKEN;

    if (!expectedToken) {
      throw new UnauthorizedException('Admin token is not configured.');
    }

    if (!headerToken || headerToken !== expectedToken) {
      throw new UnauthorizedException('Invalid admin token.');
    }

    return true;
  }
}
