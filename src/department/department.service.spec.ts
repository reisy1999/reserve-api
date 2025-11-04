import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { DepartmentService } from './department.service';
import { Department } from './entities/department.entity';

describe('DepartmentService', () => {
  let service: DepartmentService;
  let departmentRepository: jest.Mocked<Repository<Department>>;

  beforeEach(async () => {
    departmentRepository = {
      find: jest.fn(),
    } as unknown as jest.Mocked<Repository<Department>>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DepartmentService,
        {
          provide: getRepositoryToken(Department),
          useValue: departmentRepository,
        },
      ],
    }).compile();

    service = module.get<DepartmentService>(DepartmentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('findAllByActive returns mapped departments', async () => {
    departmentRepository.find.mockResolvedValue([
      { id: 'CARD', name: 'Cardiology' } as Department,
      { id: 'ER', name: 'Emergency' } as Department,
    ]);

    const result = await service.findAllByActive(true);

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(departmentRepository.find).toHaveBeenCalledWith({
      where: { active: true },
      order: { name: 'ASC' },
      select: ['id', 'name'],
    });
    expect(result).toEqual([
      { id: 'CARD', name: 'Cardiology' },
      { id: 'ER', name: 'Emergency' },
    ]);
  });
});
