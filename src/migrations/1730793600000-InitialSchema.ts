import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1730793600000 implements MigrationInterface {
  name = 'InitialSchema1730793600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create departments table
    await queryRunner.query(`
      CREATE TABLE \`departments\` (
        \`id\` VARCHAR(100) NOT NULL,
        \`name\` VARCHAR(255) NOT NULL,
        \`active\` TINYINT(1) NOT NULL DEFAULT 1,
        \`created_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Create reservation_types table
    await queryRunner.query(`
      CREATE TABLE \`reservation_types\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`name\` VARCHAR(255) NOT NULL,
        \`description\` VARCHAR(255) NULL,
        \`active\` TINYINT(1) NOT NULL DEFAULT 1,
        \`created_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Create staffs table
    await queryRunner.query(`
      CREATE TABLE \`staffs\` (
        \`staff_uid\` VARCHAR(36) NOT NULL,
        \`staff_id\` VARCHAR(255) NOT NULL,
        \`emr_patient_id\` VARCHAR(255) NULL,
        \`family_name\` VARCHAR(255) NOT NULL,
        \`given_name\` VARCHAR(255) NOT NULL,
        \`family_name_kana\` VARCHAR(255) NULL,
        \`given_name_kana\` VARCHAR(255) NULL,
        \`job_title\` VARCHAR(255) NOT NULL,
        \`department_id\` VARCHAR(100) NOT NULL,
        \`date_of_birth\` VARCHAR(255) NOT NULL,
        \`sex_code\` VARCHAR(255) NOT NULL,
        \`pin_hash\` VARCHAR(255) NOT NULL,
        \`pin_retry_count\` INT NOT NULL DEFAULT 0,
        \`pin_locked_until\` DATETIME NULL,
        \`pin_updated_at\` DATETIME NOT NULL,
        \`pin_version\` INT NOT NULL DEFAULT 1,
        \`pin_must_change\` TINYINT(1) NOT NULL DEFAULT 1,
        \`version\` INT NOT NULL DEFAULT 0,
        \`status\` VARCHAR(50) NOT NULL DEFAULT 'active',
        \`role\` VARCHAR(50) NOT NULL DEFAULT 'STAFF',
        \`last_login_at\` DATETIME NULL,
        \`created_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`staff_uid\`),
        UNIQUE INDEX \`UQ_staffs_staff_id\` (\`staff_id\`),
        UNIQUE INDEX \`UQ_staffs_emr_patient_id\` (\`emr_patient_id\`),
        INDEX \`IDX_staffs_staff_id\` (\`staff_id\`),
        INDEX \`IDX_staffs_emr_patient_id\` (\`emr_patient_id\`),
        CONSTRAINT \`FK_staffs_department\` FOREIGN KEY (\`department_id\`) REFERENCES \`departments\` (\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Create reservation_slots table
    await queryRunner.query(`
      CREATE TABLE \`reservation_slots\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`reservation_type_id\` INT NOT NULL,
        \`service_date_local\` VARCHAR(255) NOT NULL,
        \`start_minute_of_day\` INT NOT NULL,
        \`duration_minutes\` INT NOT NULL,
        \`capacity\` INT NOT NULL,
        \`booked_count\` INT NOT NULL DEFAULT 0,
        \`status\` VARCHAR(50) NOT NULL DEFAULT 'draft',
        \`booking_start\` DATETIME NULL,
        \`booking_end\` DATETIME NULL,
        \`notes\` VARCHAR(255) NULL,
        \`cancel_deadline_date_local\` DATE NULL,
        \`cancel_deadline_minute_of_day\` INT NULL,
        \`created_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_reservation_slots_type\` FOREIGN KEY (\`reservation_type_id\`) REFERENCES \`reservation_types\` (\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Create reservation_slot_departments table
    await queryRunner.query(`
      CREATE TABLE \`reservation_slot_departments\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`slot_id\` INT NOT NULL,
        \`department_id\` VARCHAR(100) NOT NULL,
        \`enabled\` TINYINT(1) NOT NULL DEFAULT 1,
        \`capacity_override\` INT NULL,
        \`created_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`UQ_reservation_slot_departments_slot_department\` (\`slot_id\`, \`department_id\`),
        INDEX \`IDX_reservation_slot_departments_department\` (\`department_id\`),
        CONSTRAINT \`FK_reservation_slot_departments_slot\` FOREIGN KEY (\`slot_id\`) REFERENCES \`reservation_slots\` (\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT \`FK_reservation_slot_departments_department\` FOREIGN KEY (\`department_id\`) REFERENCES \`departments\` (\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Create reservations table
    await queryRunner.query(`
      CREATE TABLE \`reservations\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`staff_uid\` VARCHAR(255) NOT NULL,
        \`staff_id\` VARCHAR(255) NOT NULL,
        \`reservation_type_id\` INT NOT NULL,
        \`slot_id\` INT NOT NULL,
        \`service_date_local\` VARCHAR(255) NOT NULL,
        \`start_minute_of_day\` INT NOT NULL,
        \`duration_minutes\` INT NOT NULL,
        \`period_key\` VARCHAR(255) NOT NULL,
        \`canceled_at\` DATETIME NULL,
        \`active_flag\` INT AS (CASE WHEN canceled_at IS NULL THEN 1 ELSE 0 END) STORED,
        \`created_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`UQ_reservations_slot_staff\` (\`slot_id\`, \`staff_id\`),
        UNIQUE INDEX \`UQ_reservations_active_period\` (\`staff_id\`, \`reservation_type_id\`, \`period_key\`, \`active_flag\`),
        INDEX \`IDX_reservations_staff_uid\` (\`staff_uid\`),
        CONSTRAINT \`FK_reservations_staff\` FOREIGN KEY (\`staff_uid\`) REFERENCES \`staffs\` (\`staff_uid\`) ON DELETE RESTRICT ON UPDATE NO ACTION,
        CONSTRAINT \`FK_reservations_type\` FOREIGN KEY (\`reservation_type_id\`) REFERENCES \`reservation_types\` (\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION,
        CONSTRAINT \`FK_reservations_slot\` FOREIGN KEY (\`slot_id\`) REFERENCES \`reservation_slots\` (\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Create refresh_sessions table
    await queryRunner.query(`
      CREATE TABLE \`refresh_sessions\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`staff_uid\` VARCHAR(255) NOT NULL,
        \`refresh_token_hash\` VARCHAR(255) NOT NULL,
        \`expires_at\` DATETIME NOT NULL,
        \`revoked_at\` DATETIME NULL,
        \`last_used_at\` DATETIME NULL,
        \`user_agent\` VARCHAR(255) NULL,
        \`ip_address\` VARCHAR(255) NULL,
        \`created_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        INDEX \`IDX_refresh_sessions_staff_uid\` (\`staff_uid\`),
        CONSTRAINT \`FK_refresh_sessions_staff\` FOREIGN KEY (\`staff_uid\`) REFERENCES \`staffs\` (\`staff_uid\`) ON DELETE CASCADE ON UPDATE NO ACTION
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse order due to foreign key constraints
    await queryRunner.query(`DROP TABLE IF EXISTS \`refresh_sessions\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`reservations\``);
    await queryRunner.query(
      `DROP TABLE IF EXISTS \`reservation_slot_departments\``,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS \`reservation_slots\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`staffs\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`reservation_types\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`departments\``);
  }
}
