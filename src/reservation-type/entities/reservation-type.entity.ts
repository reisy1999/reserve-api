import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ReservationSlot } from '../../reservations/entities/reservation-slot.entity';
import { Reservation } from '../../reservations/entities/reservation.entity';

@Entity('reservation_types')
export class ReservationType {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description!: string | null;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany(() => ReservationSlot, (slot) => slot.reservationType)
  slots!: ReservationSlot[];

  @OneToMany(() => Reservation, (reservation) => reservation.reservationType)
  reservations!: Reservation[];
}
