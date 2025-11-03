import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ReservationType } from '../../reservation-type/entities/reservation-type.entity';
import { Reservation } from './reservation.entity';

export type ReservationSlotStatus = 'draft' | 'published' | 'closed';

@Entity('reservation_slots')
export class ReservationSlot {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'integer', name: 'reservation_type_id' })
  reservationTypeId!: number;

  @ManyToOne(
    () => ReservationType,
    (reservationType) => reservationType.slots,
    {
      nullable: false,
      onDelete: 'RESTRICT',
    },
  )
  @JoinColumn({ name: 'reservation_type_id' })
  reservationType!: ReservationType;

  @Column({ type: 'varchar', length: 255, name: 'service_date_local' })
  serviceDateLocal!: string;

  @Column({ type: 'integer', name: 'start_minute_of_day' })
  startMinuteOfDay!: number;

  @Column({ type: 'integer', name: 'duration_minutes' })
  durationMinutes!: number;

  @Column({ type: 'integer', name: 'capacity' })
  capacity!: number;

  @Column({ type: 'integer', name: 'booked_count', default: 0 })
  bookedCount!: number;

  @Column({ type: 'varchar', length: 50, name: 'status', default: 'draft' })
  status!: ReservationSlotStatus;

  @Column({ type: 'datetime', name: 'booking_start', nullable: true })
  bookingStart!: Date | null;

  @Column({ type: 'datetime', name: 'booking_end', nullable: true })
  bookingEnd!: Date | null;

  @Column({ type: 'varchar', length: 255, name: 'notes', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany(() => Reservation, (reservation) => reservation.slot)
  reservations!: Reservation[];
}
