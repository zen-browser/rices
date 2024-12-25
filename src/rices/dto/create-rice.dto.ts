import { IsOptional, IsString } from 'class-validator';

export class CreateRiceDto {
  @IsOptional()
  @IsString()
  name?: string;
}
