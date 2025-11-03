import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { ReservationTypeController } from './reservation-type.controller';
import { ReservationTypeService } from './reservation-type.service';

const reservationTypeServiceMock = {
  findAll: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

describe('ReservationTypeController', () => {
  let controller: ReservationTypeController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReservationTypeController],
      providers: [
        {
          provide: ReservationTypeService,
          useValue: reservationTypeServiceMock,
        },
      ],
    }).compile();

    controller = module.get<ReservationTypeController>(
      ReservationTypeController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates creation to the service', async () => {
    const dto = { name: 'New Type' };
    reservationTypeServiceMock.create.mockResolvedValue('created');

    const result = await controller.create(dto as any);

    expect(reservationTypeServiceMock.create).toHaveBeenCalledWith(dto);
    expect(result).toBe('created');
  });

  it('returns all reservation types', async () => {
    const list = [{ id: 1 }];
    reservationTypeServiceMock.findAll.mockResolvedValue(list);

    const result = await controller.findAll();

    expect(reservationTypeServiceMock.findAll).toHaveBeenCalled();
    expect(result).toBe(list);
  });

  it('parses id and fetches a reservation type', async () => {
    const entity = { id: 42 };
    reservationTypeServiceMock.findOne.mockResolvedValue(entity);

    const result = await controller.findOne('42');

    expect(reservationTypeServiceMock.findOne).toHaveBeenCalledWith(42);
    expect(result).toBe(entity);
  });

  it('updates a reservation type', async () => {
    const dto = { name: 'Updated Type' };
    reservationTypeServiceMock.update.mockResolvedValue('updated');

    const result = await controller.update('3', dto as any);

    expect(reservationTypeServiceMock.update).toHaveBeenCalledWith(3, dto);
    expect(result).toBe('updated');
  });

  it('removes a reservation type', async () => {
    reservationTypeServiceMock.remove.mockResolvedValue(undefined);

    await controller.remove('5');

    expect(reservationTypeServiceMock.remove).toHaveBeenCalledWith(5);
  });
});
