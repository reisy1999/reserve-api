import { PartialType } from '@nestjs/mapped-types';
import { CreateReservationDto } from './create-reservation.dto';

// サービス層に一任
export class UpdateReservationDto extends PartialType(CreateReservationDto) {}
