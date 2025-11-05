import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Staff } from './staff/entities/staff.entity';
import { Department } from './department/entities/department.entity';
import { SecurityService } from './security/security.service';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(
    @InjectRepository(Staff)
    private readonly staffRepository: Repository<Staff>,
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,
    private readonly securityService: SecurityService,
  ) {}

  getHello(): string {
    return 'Hello World!';
  }

  async initializeDefaultAdmin(): Promise<void> {
    const defaultStaffId = process.env.DEFAULT_ADMIN_STAFF_ID || '252942';
    const defaultPin = process.env.DEFAULT_ADMIN_PIN || '0000';
    const defaultFullName = process.env.DEFAULT_ADMIN_NAME || '阿部　連一朗';
    const defaultDepartmentId = process.env.DEFAULT_ADMIN_DEPARTMENT || 'admin';

    // 既に管理者ユーザーが存在するかチェック
    const existingAdmin = await this.staffRepository.findOne({
      where: { staffId: defaultStaffId },
    });

    if (existingAdmin) {
      this.logger.log(
        `Default admin user (staffId: ${defaultStaffId}) already exists. Skipping initialization.`,
      );
      return;
    }

    // 名前を分割（姓と名）
    const nameParts = defaultFullName.split(/[\s\u3000]+/); // 全角・半角スペースで分割
    const familyName = nameParts[0] || defaultFullName;
    const givenName = nameParts.slice(1).join(' ') || defaultFullName;

    // 部署を作成または取得
    let department = await this.departmentRepository.findOne({
      where: { id: defaultDepartmentId },
    });

    if (!department) {
      department = this.departmentRepository.create({
        id: defaultDepartmentId,
        name: '管理部門',
        active: true,
      });
      await this.departmentRepository.save(department);
      this.logger.log(`Created default department: ${defaultDepartmentId}`);
    }

    // PINをハッシュ化
    const pinHash = await this.securityService.hash(defaultPin);

    // 管理者ユーザーを作成
    const admin = this.staffRepository.create({
      staffId: defaultStaffId,
      familyName,
      givenName,
      familyNameKana: null,
      givenNameKana: null,
      department,
      departmentId: department.id,
      jobTitle: '管理者',
      emrPatientId: null,
      dateOfBirth: '1900-01-01',
      sexCode: '1',
      pinHash,
      pinRetryCount: 0,
      pinLockedUntil: null,
      pinUpdatedAt: new Date(),
      pinVersion: 1,
      pinMustChange: true,
      version: 0,
      status: 'active',
      role: 'ADMIN',
      lastLoginAt: null,
    });

    await this.staffRepository.save(admin);

    this.logger.log(
      `✓ Default admin user created successfully (staffId: ${defaultStaffId}, role: ADMIN)`,
    );
    this.logger.log(
      `  Login with staffId: ${defaultStaffId} and PIN: ${defaultPin}`,
    );
  }
}
