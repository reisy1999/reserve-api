import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ReservationTypeService } from './reservation-type.service';
import { ReservationType } from './entities/reservation-type.entity';

const createRepositoryMock = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
});

describe('ReservationTypeService', () => {
  let service: ReservationTypeService;
  let repository: ReturnType<typeof createRepositoryMock>;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservationTypeService,
        {
          provide: getRepositoryToken(ReservationType),
          useValue: createRepositoryMock(),
        },
      ],
    }).compile();

    service = module.get<ReservationTypeService>(ReservationTypeService);
    repository = module.get<ReturnType<typeof createRepositoryMock>>(
      getRepositoryToken(ReservationType),
    );
    repository.create.mockImplementation(
      (data) => ({ ...(data as Record<string, unknown>) }) as ReservationType,
    );
    repository.save.mockImplementation(async (entity) => entity);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('creates a reservation type', async () => {
    const dto = { name: 'General', description: 'Desc', active: true };

    const result = await service.create(dto);

    expect(repository.create).toHaveBeenCalledWith({
      name: dto.name,
      description: dto.description,
      active: dto.active,
    });
    expect(repository.save).toHaveBeenCalled();
    expect(result).toMatchObject(dto);
  });

  it('defaults active to true when creating a reservation type', async () => {
    const dto = { name: 'Default Active' };

    const result = await service.create(dto);

    expect(repository.create).toHaveBeenCalledWith({
      name: dto.name,
      description: null,
      active: true,
    });
    expect(result).toMatchObject({
      name: dto.name,
      active: true,
      description: null,
    });
  });

  it('returns all reservation types', async () => {
    const list = [{ id: 1 } as ReservationType];
    repository.find.mockResolvedValue(list);

    const result = await service.findAll();

    expect(repository.find).toHaveBeenCalled();
    expect(result).toBe(list);
  });

  it('finds a reservation type by id', async () => {
    const entity = { id: 1 } as ReservationType;
    repository.findOne.mockResolvedValue(entity);

    const result = await service.findOne(1);

    expect(repository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(result).toBe(entity);
  });

  it('throws when reservation type cannot be found', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(service.findOne(1)).rejects.toThrow(
      'Reservation type not found',
    );
  });

  it('updates an existing reservation type', async () => {
    const entity = {
      id: 1,
      name: 'Original',
      description: null,
      active: true,
    } as ReservationType;
    repository.findOne.mockResolvedValue(entity);
    repository.save.mockImplementation(async (updated) => updated);

    const result = await service.update(1, {
      name: 'Updated',
      description: 'New desc',
      active: false,
    });

    expect(repository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 1,
        name: 'Updated',
        description: 'New desc',
        active: false,
      }),
    );
    expect(result).toMatchObject({
      name: 'Updated',
      description: 'New desc',
      active: false,
    });
  });

  it('removes an existing reservation type', async () => {
    const entity = { id: 1 } as ReservationType;
    repository.findOne.mockResolvedValue(entity);

    await service.remove(1);

    expect(repository.remove).toHaveBeenCalledWith(entity);
  });
});
