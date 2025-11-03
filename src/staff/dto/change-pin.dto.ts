import { IsDefined, IsString, Matches } from 'class-validator';

export class ChangePinDto {
  @IsDefined()
  @IsString()
  @Matches(/^\d{4}$/)
  currentPin!: string;

  @IsDefined()
  @IsString()
  @Matches(/^\d{4}$/)
  newPin!: string;
}
