import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Strategy, type StrategyOptions } from 'passport-jwt';
import type { Request } from 'express';
import { Staff } from '../../staff/entities/staff.entity';

interface JwtPayload {
  sub: string;
  sid: string;
  role: string;
  status: string;
}

function bearerTokenExtractor(request: Request): string | null {
  const header = request.headers?.authorization;
  if (typeof header !== 'string') {
    return null;
  }
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null;
  }
  return token;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    @InjectRepository(Staff)
    private readonly staffRepository: Repository<Staff>,
  ) {
    const strategyOptions: StrategyOptions = {
      jwtFromRequest: bearerTokenExtractor,
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? 'change-me',
    };
    // passport-jwt strategy constructor is provided by JS runtime; suppress unsafe-call lint here.

    super(strategyOptions);
  }

  async validate(payload: JwtPayload): Promise<Staff> {
    const staff = await this.staffRepository.findOne({
      where: { staffUid: payload.sub },
      relations: ['department'],
    });
    if (!staff) {
      this.logger.warn(`Staff not found for token subject ${payload.sub}`);
      throw new UnauthorizedException('Invalid access token');
    }
    if (staff.status !== 'active') {
      this.logger.warn(
        `Inactive staff attempted access: ${payload.sub} (${staff.status})`,
      );
      throw new UnauthorizedException(
        'Account revoked due to security incident.',
      );
    }
    return staff;
  }
}
