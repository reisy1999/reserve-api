import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { ReservationTypeService } from './reservation-type.service';

describe('ReservationTypeService', () => {
  let service: ReservationTypeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ReservationTypeService],
    }).compile();

    service = module.get<ReservationTypeService>(ReservationTypeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
