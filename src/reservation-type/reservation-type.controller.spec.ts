import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { ReservationTypeController } from './reservation-type.controller';
import { ReservationTypeService } from './reservation-type.service';

describe('ReservationTypeController', () => {
  let controller: ReservationTypeController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReservationTypeController],
      providers: [ReservationTypeService],
    }).compile();

    controller = module.get<ReservationTypeController>(
      ReservationTypeController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
