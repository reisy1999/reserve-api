import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  RelationId,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Department } from '../../department/entities/department.entity';
import { RefreshSession } from '../../auth/entities/refresh-session.entity';
import { Reservation } from '../../reservations/entities/reservation.entity';

export type StaffStatus = 'active' | 'suspended' | 'left';
export type StaffRole = 'STAFF' | 'ADMIN';

@Entity('staffs')
@Unique('UQ_staffs_staff_id', ['staffId'])
@Unique('UQ_staffs_emr_patient_id', ['emrPatientId'])
export class Staff {
  @PrimaryGeneratedColumn('uuid', { name: 'staff_uid' })
  staffUid!: string;

  @Column({ type: 'varchar', length: 255, name: 'staff_id' })
  @Index('IDX_staffs_staff_id')
  staffId!: string;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'emr_patient_id',
    nullable: true,
  })
  @Index('IDX_staffs_emr_patient_id')
  emrPatientId!: string | null;

  @Column({ type: 'varchar', length: 255, name: 'family_name' })
  familyName!: string;

  @Column({ type: 'varchar', length: 255, name: 'given_name' })
  givenName!: string;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'family_name_kana',
    nullable: true,
  })
  familyNameKana!: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'given_name_kana',
    nullable: true,
  })
  givenNameKana!: string | null;

  @Column({ type: 'varchar', length: 255, name: 'job_title' })
  jobTitle!: string;

  @ManyToOne(() => Department, (department) => department.staffs, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'department_id' })
  department!: Department;

  @RelationId((staff: Staff) => staff.department)
  departmentId!: string;

  @Column({ type: 'varchar', length: 255, name: 'date_of_birth' })
  dateOfBirth!: string;

  @Column({ type: 'varchar', length: 255, name: 'sex_code' })
  sexCode!: '1' | '2';

  @Column({ type: 'varchar', length: 255, name: 'pin_hash' })
  pinHash!: string;

  @Column({ type: 'integer', name: 'pin_retry_count', default: 0 })
  pinRetryCount!: number;

  @Column({ type: 'datetime', name: 'pin_locked_until', nullable: true })
  pinLockedUntil!: Date | null;

  @Column({ type: 'datetime', name: 'pin_updated_at' })
  pinUpdatedAt!: Date;

  @Column({ type: 'integer', name: 'pin_version', default: 1 })
  pinVersion!: number;

  @Column({ type: 'boolean', name: 'pin_must_change', default: true })
  pinMustChange!: boolean;

  @Column({ type: 'integer', name: 'version', default: 0 })
  version!: number;

  @Column({ type: 'varchar', length: 50, name: 'status', default: 'active' })
  status!: StaffStatus;

  @Column({ type: 'varchar', length: 50, name: 'role', default: 'STAFF' })
  role!: StaffRole;

  @Column({ type: 'datetime', name: 'last_login_at', nullable: true })
  lastLoginAt!: Date | null;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'updated_at' })
  updatedAt!: Date;

  // Relations
  @OneToMany(() => RefreshSession, (session) => session.staff)
  refreshSessions!: RefreshSession[];

  @OneToMany(() => Reservation, (reservation) => reservation.staff)
  reservations!: Reservation[];
}
