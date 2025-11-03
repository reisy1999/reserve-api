import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  JwtService,
  type JwtSignOptions,
  type JwtVerifyOptions,
} from '@nestjs/jwt';
import type { JwtPayload } from 'jsonwebtoken';
import type { StringValue } from 'ms';
import { Repository } from 'typeorm';
import { StaffService } from '../staff/staff.service';
import { RefreshSession } from './entities/refresh-session.entity';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { SecurityService } from '../security/security.service';
import { Staff } from '../staff/entities/staff.entity';

export interface TokenResponse {
  tokenType: 'Bearer';
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface RefreshTokenPayload {
  sub: string;
  sid: string;
  sessionId: number;
  exp: number;
}

type RefreshTokenPayloadBase = Omit<RefreshTokenPayload, 'exp'>;

@Injectable()
export class AuthService {
  private readonly maxPinAttempts = 5;
  private readonly refreshSecret =
    process.env.REFRESH_SECRET ?? 'change-refresh';
  private readonly refreshExpiresIn = process.env.REFRESH_EXPIRES_IN ?? '30d';
  private readonly logger = new Logger(AuthService.name);

  private readonly refreshTokenSignOptions: JwtSignOptions = {
    secret: this.refreshSecret,
    expiresIn: this.refreshExpiresIn as StringValue,
  };

  private isJwtPayloadWithExp(
    payload: unknown,
  ): payload is JwtPayload & { exp: number } {
    return (
      typeof payload === 'object' &&
      payload !== null &&
      'exp' in payload &&
      typeof (payload as { exp?: unknown }).exp === 'number'
    );
  }

  constructor(
    private readonly staffService: StaffService,
    @InjectRepository(RefreshSession)
    private readonly refreshSessionRepository: Repository<RefreshSession>,
    private readonly jwtService: JwtService,
    private readonly securityService: SecurityService,
  ) {}

  private unauthorized(extra: Record<string, unknown>): never {
    throw new HttpException(
      {
        statusCode: HttpStatus.UNAUTHORIZED,
        ...extra,
      },
      HttpStatus.UNAUTHORIZED,
    );
  }

  private locked(extra: Record<string, unknown>): never {
    throw new HttpException(
      {
        statusCode: HttpStatus.LOCKED,
        ...extra,
      },
      HttpStatus.LOCKED,
    );
  }

  private accessTokenTTLSeconds(): number {
    const raw = process.env.JWT_EXPIRES_IN ?? '900';
    const match = /^(\d+)(s|m|h|d)?$/i.exec(raw);
    if (!match) return Number(raw) || 900;
    const value = Number(match[1]);
    const unit = match[2]?.toLowerCase();
    switch (unit) {
      case 'd':
        return value * 86400;
      case 'h':
        return value * 3600;
      case 'm':
        return value * 60;
      default:
        return value;
    }
  }

  private buildAccessTokenPayload(staff: Staff): {
    sub: string;
    sid: string;
    role: string;
    status: string;
  } {
    return {
      sub: staff.staffUid,
      sid: staff.staffId,
      role: staff.role,
      status: staff.status,
    };
  }

  private async createRefreshToken(
    staff: Staff,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<{ token: string; session: RefreshSession }> {
    const basePayload: RefreshTokenPayloadBase = {
      sub: staff.staffUid,
      sid: staff.staffId,
      sessionId: Date.now(),
    };
    const unsignedToken = this.jwtService.sign(
      basePayload,
      this.refreshTokenSignOptions,
    );
    const decodedRaw: unknown = this.jwtService.decode(unsignedToken);
    if (!this.isJwtPayloadWithExp(decodedRaw)) {
      this.logger.error('Failed to decode initial refresh token payload');
      throw new HttpException(
        'Unable to generate refresh token.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const session = this.refreshSessionRepository.create({
      staffUid: staff.staffUid,
      staff,
      refreshTokenHash: await this.securityService.hash(unsignedToken),
      expiresAt: new Date(decodedRaw.exp * 1000),
      revokedAt: null,
      lastUsedAt: null,
      userAgent: userAgent ?? null,
      ipAddress: ipAddress ?? null,
    });
    const saved = await this.refreshSessionRepository.save(session);

    const finalTokenPayload: RefreshTokenPayloadBase = {
      ...basePayload,
      sessionId: saved.id,
    };
    const finalToken = this.jwtService.sign(
      finalTokenPayload,
      this.refreshTokenSignOptions,
    );

    saved.refreshTokenHash = await this.securityService.hash(finalToken);
    await this.refreshSessionRepository.save(saved);

    return { token: finalToken, session: saved };
  }

  private buildSuccessResponse(
    accessToken: string,
    refreshToken: string,
  ): TokenResponse {
    return {
      tokenType: 'Bearer',
      accessToken,
      refreshToken,
      expiresIn: this.accessTokenTTLSeconds(),
    };
  }

  private ensureStaffLoginAllowed(staff: Staff): void {
    if (staff.status !== 'active') {
      this.unauthorized({
        message: 'Account revoked due to security incident.',
      });
    }
    if (staff.pinLockedUntil) {
      this.locked({
        message: 'PIN locked due to repeated failures.',
        retryAfter: staff.pinLockedUntil.toISOString(),
      });
    }
  }

  private remainingAttempts(staff: Staff): number {
    return Math.max(this.maxPinAttempts - staff.pinRetryCount, 0);
  }

  async login(
    dto: LoginDto,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<TokenResponse> {
    const staff = await this.staffService.findByStaffId(dto.staffId);
    if (!staff) {
      this.unauthorized({ message: 'invalid credentials' });
    }

    this.ensureStaffLoginAllowed(staff);

    const pinMatches = await this.securityService.verify(
      dto.pin,
      staff.pinHash,
    );
    if (!pinMatches) {
      const updated = await this.staffService.incrementFailedPin(staff);

      if (updated.pinLockedUntil) {
        this.locked({
          message: 'PIN locked due to repeated failures.',
          retryAfter: updated.pinLockedUntil.toISOString(),
        });
      }

      this.unauthorized({
        message: 'invalid credentials',
        attemptsRemaining: this.remainingAttempts(updated),
      });
    }

    const clearedStaff = await this.staffService.resetPinFailures(staff);
    await this.staffService.recordSuccessfulLogin(clearedStaff);

    const accessToken = this.jwtService.sign(
      this.buildAccessTokenPayload(clearedStaff),
    );
    const { token: refreshToken } = await this.createRefreshToken(
      clearedStaff,
      userAgent,
      ipAddress,
    );

    return this.buildSuccessResponse(accessToken, refreshToken);
  }

  async refreshToken(
    dto: RefreshTokenDto,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<TokenResponse> {
    let decoded: RefreshTokenPayload;
    try {
      const verifyOptions: JwtVerifyOptions = {
        secret: this.refreshSecret,
      };
      decoded = this.jwtService.verify<RefreshTokenPayload>(
        dto.refreshToken,
        verifyOptions,
      );
    } catch {
      this.unauthorized({ message: 'Refresh token invalid.' });
    }

    const session = await this.refreshSessionRepository.findOne({
      where: { id: decoded.sessionId },
      relations: ['staff'],
    });

    if (!session || session.revokedAt || session.staffUid !== decoded.sub) {
      await this.handleRefreshReuse(decoded.sub);
      this.unauthorized({ message: 'Refresh token revoked.' });
    }

    const matches = await this.securityService.verify(
      dto.refreshToken,
      session.refreshTokenHash,
    );
    if (!matches) {
      await this.handleRefreshReuse(decoded.sub);
      this.unauthorized({ message: 'Refresh token revoked.' });
    }

    session.revokedAt = new Date();
    session.lastUsedAt = new Date();
    await this.refreshSessionRepository.save(session);

    const staff = await this.staffService.findByStaffUid(decoded.sub);
    if (!staff) {
      this.unauthorized({ message: 'Refresh token revoked.' });
    }

    const accessToken = this.jwtService.sign(
      this.buildAccessTokenPayload(staff),
    );
    const { token: refreshToken } = await this.createRefreshToken(
      staff,
      userAgent,
      ipAddress,
    );

    return this.buildSuccessResponse(accessToken, refreshToken);
  }

  private async handleRefreshReuse(staffUid: string): Promise<void> {
    await this.refreshSessionRepository.update(
      { staffUid },
      {
        revokedAt: new Date(),
      },
    );
    const staff = await this.staffService.findByStaffUid(staffUid);
    if (staff) {
      await this.staffService.updateStatus(staff, 'suspended');
    }
  }
}
