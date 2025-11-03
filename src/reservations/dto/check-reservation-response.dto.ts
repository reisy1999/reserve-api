import type { Reservation } from '../entities/reservation.entity';

export class CheckReservationResponseDto {
  exists!: boolean;
  reservation?: Reservation;
}
