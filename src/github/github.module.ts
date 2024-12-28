import { Module } from '@nestjs/common';
import { GitHubService } from './github.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [GitHubService],
  exports: [GitHubService],
})
export class GitHubModule {}
