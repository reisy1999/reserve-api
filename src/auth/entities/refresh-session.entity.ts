import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Staff } from '../../staff/entities/staff.entity';

@Entity('refresh_sessions')
export class RefreshSession {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 255, name: 'staff_uid' })
  @Index('IDX_refresh_sessions_staff_uid')
  staffUid!: string;

  @ManyToOne(() => Staff, { nullable: false, onDelete: 'CASCADE' })
  staff!: Staff;

  @Column({ type: 'varchar', length: 255, name: 'refresh_token_hash' })
  refreshTokenHash!: string;

  @Column({ type: 'datetime', name: 'expires_at' })
  expiresAt!: Date;

  @Column({ type: 'datetime', name: 'revoked_at', nullable: true })
  revokedAt!: Date | null;

  @Column({ type: 'datetime', name: 'last_used_at', nullable: true })
  lastUsedAt!: Date | null;

  @Column({ type: 'varchar', length: 255, name: 'user_agent', nullable: true })
  userAgent!: string | null;

  @Column({ type: 'varchar', length: 255, name: 'ip_address', nullable: true })
  ipAddress!: string | null;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'updated_at' })
  updatedAt!: Date;
}
