import { IsOptional, IsString } from 'class-validator';

export class UpdateRiceDto {
  @IsOptional()
  @IsString()
  name?: string;
}
