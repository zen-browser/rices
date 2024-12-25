import { Test, TestingModule } from '@nestjs/testing';
import { GitHubService } from './github.service';

describe('GithubService', () => {
  let service: GitHubService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GitHubService],
    }).compile();

    service = module.get<GitHubService>(GitHubService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
