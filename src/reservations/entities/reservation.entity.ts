import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('reservations')
export class Reservation {
  @PrimaryGeneratedColumn('increment') // 自動採番
  id: number;

  @Column({ type: 'text' }) // 既方針どおり staffId は string
  staffId: string;

  @Column({ type: 'integer' })
  reservationTypeId: number;

  @Column({ type: 'text' }) // 'YYYY-MM-DD' を保存
  serviceDateLocal: string;

  @Column({ type: 'integer' }) // 0–1439 を想定
  startMinuteOfDay: number;

  @Column({ type: 'integer' }) // 必須（ここが抜けると今回のエラー）
  durationMinutes: number;

  @Column({ type: 'text', nullable: true }) // 暫定：nullableで進める
  periodKey: string | null;
}
