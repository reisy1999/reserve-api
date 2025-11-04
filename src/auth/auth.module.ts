import { Global, Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import type { StringValue } from 'ms';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { StaffModule } from '../staff/staff.module';
import { Staff } from '../staff/entities/staff.entity';
import { RefreshSession } from './entities/refresh-session.entity';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { SecurityModule } from '../security/security.module';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([Staff, RefreshSession]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET ?? 'change-me',
        signOptions: {
          expiresIn: (process.env.JWT_EXPIRES_IN ?? '900s') as StringValue,
        },
      }),
    }),
    forwardRef(() => StaffModule),
    SecurityModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard],
  exports: [AuthService, JwtAuthGuard, JwtStrategy, PassportModule],
})
export class AuthModule {}
