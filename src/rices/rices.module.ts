// src/rices/rices.module.ts

import { Module } from '@nestjs/common';
import { RicesService } from './rices.service';
import { GitHubModule } from '../github/github.module';
import { RicesController } from './rices.controller';

@Module({
  imports: [GitHubModule],
  providers: [RicesService],
  controllers: [RicesController],
  exports: [RicesService],
})
export class RicesModule {}
