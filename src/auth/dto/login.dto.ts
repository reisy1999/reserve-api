import { IsDefined, IsString, Matches } from 'class-validator';

export class LoginDto {
  @IsDefined()
  @IsString()
  @Matches(/^\d+$/)
  staffId!: string;

  @IsDefined()
  @IsString()
  @Matches(/^\d{4}$/)
  pin!: string;
}
