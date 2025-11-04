import {
  Column,
  Entity,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
  CreateDateColumn,
} from 'typeorm';
import { Staff } from '../../staff/entities/staff.entity';
import { ReservationSlotDepartment } from '../../reservations/entities/reservation-slot-department.entity';

@Entity('departments')
export class Department {
  @PrimaryColumn({ type: 'varchar', length: 100 })
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany(() => Staff, (staff) => staff.department)
  staffs!: Staff[];

  @OneToMany(
    () => ReservationSlotDepartment,
    (slotDepartment) => slotDepartment.department,
  )
  slotDepartments!: ReservationSlotDepartment[];
}
