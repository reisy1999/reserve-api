import { Entity } from 'typeorm';

@Entity('reservations')
export class Reservation {
  id: number;
  staffId: number;
}
