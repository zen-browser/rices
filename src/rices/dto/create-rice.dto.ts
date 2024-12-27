import { IsString } from 'class-validator';

export class CreateRiceDto {
  @IsString()
  name!: string;

  @IsString()
  version!: string;

  @IsString()
  os!: string;

  @IsString()
  content!: string;
}
