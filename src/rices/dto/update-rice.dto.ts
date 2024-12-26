import { IsString } from 'class-validator';

export class UpdateRiceDto {
  @IsString()
  content!: string;
}
