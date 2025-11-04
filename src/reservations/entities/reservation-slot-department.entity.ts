import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { ReservationSlot } from './reservation-slot.entity';
import { Department } from '../../department/entities/department.entity';

@Entity('reservation_slot_departments')
@Unique('UQ_reservation_slot_departments_slot_department', [
  'slotId',
  'departmentId',
])
export class ReservationSlotDepartment {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'integer', name: 'slot_id' })
  slotId!: number;

  @ManyToOne(() => ReservationSlot, (slot) => slot.slotDepartments, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'slot_id' })
  slot!: ReservationSlot;

  @Index('IDX_reservation_slot_departments_department')
  @Column({ type: 'varchar', length: 100, name: 'department_id' })
  departmentId!: string;

  @ManyToOne(() => Department, (department) => department.slotDepartments, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'department_id', referencedColumnName: 'id' })
  department!: Department;

  @Column({ type: 'boolean', default: true })
  enabled!: boolean;

  @Column({ type: 'integer', name: 'capacity_override', nullable: true })
  capacityOverride!: number | null;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'updated_at' })
  updatedAt!: Date;
}
