import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { ReservationType } from '../../reservation-type/entities/reservation-type.entity';
import { Staff } from '../../staff/entities/staff.entity';
import { ReservationSlot } from './reservation-slot.entity';

@Entity('reservations')
@Unique('UQ_reservations_slot_staff', ['slotId', 'staffId'])
@Index(
  'UQ_reservations_active_period',
  ['staffId', 'reservationTypeId', 'periodKey', 'activeFlag'],
  { unique: true },
)
export class Reservation {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ type: 'varchar', length: 255, name: 'staff_uid' })
  @Index('IDX_reservations_staff_uid')
  staffUid!: string;

  @Column({ type: 'varchar', length: 255, name: 'staff_id' })
  staffId!: string;

  @ManyToOne(() => Staff, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'staff_uid', referencedColumnName: 'staffUid' })
  staff!: Staff;

  @Column({ type: 'integer', name: 'reservation_type_id' })
  reservationTypeId!: number;

  @ManyToOne(() => ReservationType, (type) => type.reservations, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'reservation_type_id' })
  reservationType!: ReservationType;

  @Column({ type: 'integer', name: 'slot_id' })
  slotId!: number;

  @ManyToOne(() => ReservationSlot, (slot) => slot.reservations, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'slot_id' })
  slot!: ReservationSlot;

  @Column({ type: 'varchar', length: 255, name: 'service_date_local' })
  serviceDateLocal!: string;

  @Column({ type: 'integer', name: 'start_minute_of_day' })
  startMinuteOfDay!: number;

  @Column({ type: 'integer', name: 'duration_minutes' })
  durationMinutes!: number;

  @Column({ type: 'varchar', length: 255, name: 'period_key' })
  periodKey!: string;

  @Column({ type: 'datetime', name: 'canceled_at', nullable: true })
  canceledAt!: Date | null;

  @Column({
    type: 'int',
    name: 'active_flag',
    generatedType: 'STORED',
    asExpression: 'CASE WHEN canceled_at IS NULL THEN 1 ELSE 0 END',
    select: false,
    insert: false,
    update: false,
  })
  activeFlag!: number;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'updated_at' })
  updatedAt!: Date;
}
