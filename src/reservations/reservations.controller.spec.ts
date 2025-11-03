import { Test, type TestingModule } from '@nestjs/testing';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';

const reservationsServiceMock = {
  createForStaff: jest.fn(),
};

describe('ReservationsController', () => {
  let controller: ReservationsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReservationsController],
      providers: [
        {
          provide: ReservationsService,
          useValue: reservationsServiceMock,
        },
      ],
    }).compile();

    controller = module.get<ReservationsController>(ReservationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('creates a reservation for the current staff', async () => {
    const staff = { staffUid: 'staff-uid' } as any;
    const dto = { slotId: 12 };
    reservationsServiceMock.createForStaff.mockResolvedValue('created');

    const result = await controller.create(staff, dto as any);

    expect(reservationsServiceMock.createForStaff).toHaveBeenCalledWith(
      staff,
      dto.slotId,
    );
    expect(result).toBe('created');
  });
});
