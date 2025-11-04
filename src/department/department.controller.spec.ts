import { Test } from '@nestjs/testing';
import { DepartmentController } from './department.controller';
import { DepartmentService } from './department.service';
import type { TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';

describe('DepartmentController', () => {
  let controller: DepartmentController;
  let service: { findAllByActive: jest.Mock };

  beforeEach(async () => {
    service = {
      findAllByActive: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DepartmentController],
      providers: [
        {
          provide: DepartmentService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<DepartmentController>(DepartmentController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('returns active departments when query is omitted', async () => {
    service.findAllByActive.mockResolvedValue([{ id: 'A', name: 'Alpha' }]);

    await expect(controller.findAll(undefined)).resolves.toEqual([
      { id: 'A', name: 'Alpha' },
    ]);
    expect(service.findAllByActive).toHaveBeenCalledWith(true);
  });

  it('returns inactive departments when active=false', async () => {
    service.findAllByActive.mockResolvedValue([{ id: 'B', name: 'Beta' }]);

    await expect(controller.findAll('false')).resolves.toEqual([
      { id: 'B', name: 'Beta' },
    ]);
    expect(service.findAllByActive).toHaveBeenCalledWith(false);
  });

  it('throws when active is not boolean string', async () => {
    await expect(controller.findAll('yes')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(service.findAllByActive).not.toHaveBeenCalled();
  });
});
