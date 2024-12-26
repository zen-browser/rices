// src/rices/rices.module.ts

import { Module } from '@nestjs/common';
import { RicesService } from './rices.service';
import { GitHubModule } from '../github/github.module';
import { RicesController } from './rices.controller';
import { SupabaseService } from '../supabase/supabase.service';

@Module({
  imports: [GitHubModule],
  providers: [RicesService, SupabaseService],
  controllers: [RicesController],
  exports: [RicesService],
})
export class RicesModule {}
