import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('reservations')
export class Reservation {
  @PrimaryGeneratedColumn()
  id: number;
  @Column()
  staffId: number;
  @Column()
  reservationTypeId: number;
  @Column()
  serviceDateLocal: string; //YYYY-MM-DD
  @Column()
  startMinuteOfDay: number;
  @Column()
  durationMinutes: number;
  @Column()
  periodKey: string;
}
