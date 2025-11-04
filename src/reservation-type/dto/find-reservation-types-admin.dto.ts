import type { ReservationType } from '../entities/reservation-type.entity';

export interface FindReservationTypesAdminDto {
  limit: number;
  page: number;
  name?: string;
  active?: boolean;
  sort: 'id' | 'name' | 'updatedAt';
  order: 'asc' | 'desc';
}

export interface ReservationTypeAdminResponse {
  id: number;
  name: string;
  description: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedReservationTypesResponse {
  data: ReservationTypeAdminResponse[];
  meta: {
    total: number;
    page: number;
    limit: number;
  };
}

export function mapToAdminResponse(
  entity: ReservationType,
): ReservationTypeAdminResponse {
  return {
    id: entity.id,
    name: entity.name,
    description: entity.description,
    active: entity.active,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}
