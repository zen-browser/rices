import { IsString } from 'class-validator';

export class CreateRiceDto {
  @IsString()
  name!: string;

  @IsString()
  content!: string;
}
