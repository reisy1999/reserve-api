import { IsDefined, IsString } from 'class-validator';

export class RefreshTokenDto {
  @IsDefined()
  @IsString()
  refreshToken!: string;
}
