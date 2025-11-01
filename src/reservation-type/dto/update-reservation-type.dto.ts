import { PartialType } from '@nestjs/mapped-types';
import { CreateReservationTypeDto } from './create-reservation-type.dto';

export class UpdateReservationTypeDto extends PartialType(CreateReservationTypeDto) {}
