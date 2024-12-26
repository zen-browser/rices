import {
  Injectable,
  OnModuleInit,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { Octokit } from '@octokit/rest';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';

/**
 * Type guard to verify if the error has a 'status' property of type 'number'
 * and a 'message' property of type 'string'.
 */
function isOctokitResponseError(
  error: any,
): error is { status: number; message: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof error.status === 'number' &&
    'message' in error &&
    typeof error.message === 'string'
  );
}

@Injectable()
export class GitHubService implements OnModuleInit {
  private octokit!: Octokit;
  private readonly logger = new Logger(GitHubService.name);
  private repoOwner: string;
  private repoName: string;
  private defaultBranch: string = 'main'; // Default value
  private directoryLocks: Map<string, boolean> = new Map();

  constructor(private configService: ConfigService) {
    // Initialize properties in the constructor
    this.repoOwner = this.configService.get<string>('GITHUB_REPO_OWNER') || '';
    this.repoName = this.configService.get<string>('GITHUB_REPO_NAME') || '';
  }

  async onModuleInit() {
    const token = this.configService.get<string>('GITHUB_TOKEN');
    if (!token) {
      this.logger.error(
        'GITHUB_TOKEN is not defined in the environment variables',
      );
      throw new Error('GITHUB_TOKEN is not defined');
    }

    if (!this.repoOwner || !this.repoName) {
      this.logger.error(
        'GITHUB_REPO_OWNER or GITHUB_REPO_NAME is not defined in the environment variables',
      );
      throw new Error('GITHUB_REPO_OWNER or GITHUB_REPO_NAME is not defined');
    }

    this.octokit = new Octokit({
      auth: token,
    });

    // Fetch the default branch of the repository
    try {
      const { data: repo } = await this.octokit.repos.get({
        owner: this.repoOwner,
        repo: this.repoName,
      });
      this.defaultBranch = repo.default_branch;
      this.logger.log(
        `Default branch of the repository: ${this.defaultBranch}`,
      );
    } catch (error) {
      if (isOctokitResponseError(error)) {
        if (error.status === 404) {
          this.logger.error(
            `Repository ${this.repoOwner}/${this.repoName} not found.`,
          );
        } else {
          this.logger.error(
            `Error fetching repository information: ${error.message} (Status: ${error.status})`,
          );
        }
      } else {
        this.logger.error(
          `Unexpected error fetching repository information: ${error}`,
        );
      }
      throw error;
    }
  }

  /**
   * Create or update a file in the repository.
   * Ensures that the specified directory exists by creating a .gitkeep file if necessary.
   * @param filePath Path of the file in the repository.
   * @param content Content of the file in plain text.
   * @param commitMessage Commit message.
   */
  async createOrUpdateFile(
    filePath: string,
    content: string,
    commitMessage: string,
    retries = 3,
  ): Promise<void> {
    const directoryPath = path.dirname(filePath);
    await this.lockDirectory(directoryPath);
    try {
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          // Get the SHA of the file if it exists
          let sha: string | undefined;
          try {
            const { data: existingFile } = await this.octokit.repos.getContent({
              owner: this.repoOwner,
              repo: this.repoName,
              path: filePath,
              ref: this.defaultBranch,
            });
            if ('sha' in existingFile) {
              sha = existingFile.sha;
            }
          } catch (error) {
            // File does not exist, proceed to create it
            if (isOctokitResponseError(error)) {
              if (error.status !== 404) {
                this.logger.error(
                  `Error checking file ${filePath}: ${error.message} (Status: ${error.status})`,
                );
                throw error;
              }
              // If the error is 404, the file does not exist and we can proceed to create it
            } else {
              throw error;
            }
          }

          // Attempt to create or update the file
          await this.octokit.repos.createOrUpdateFileContents({
            owner: this.repoOwner,
            repo: this.repoName,
            path: filePath,
            message: commitMessage,
            content: Buffer.from(content, 'utf-8').toString('base64'),
            sha,
            branch: this.defaultBranch,
          });

          this.logger.log(`File ${filePath} created/updated successfully.`);
          return;
        } catch (error: any) {
          if (error.status === 409 && attempt < retries) {
            this.logger.warn(
              `Conflict creating/updating ${filePath}. Retrying (${attempt}/${retries})...`,
            );
            const backoffTime = 1000 * Math.pow(2, attempt - 1); // 1s, 2s, 4s
            await this.delay(backoffTime);
            continue;
          }

          if (error.status === 409) {
            this.logger.error(
              `Persistent conflict creating/updating ${filePath}: ${error.message}`,
            );
            throw new InternalServerErrorException(
              `Error creating/updating file ${filePath}: ${error.message}`,
            );
          }

          this.logger.error(
            `Error creating/updating file ${filePath}: ${error.message}`,
          );
          throw new InternalServerErrorException(
            `Error creating/updating file ${filePath}: ${error.message}`,
          );
        }
      }
    } finally {
      this.unlockDirectory(directoryPath);
    }
  }

  /**
   * Deletes a file from the repository.
   * @param filePath Path of the file in the repository.
   * @param commitMessage Commit message.
   */
  async deleteFile(
    filePath: string,
    commitMessage: string,
    retries = 3,
  ): Promise<void> {
    try {
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          // Get the file's SHA
          const { data: existingFile } = await this.octokit.repos.getContent({
            owner: this.repoOwner,
            repo: this.repoName,
            path: filePath,
            ref: this.defaultBranch,
          });

          if (!('sha' in existingFile)) {
            throw new Error(`The file ${filePath} does not have a valid SHA`);
          }

          const sha = existingFile.sha;

          // Attempt to delete the file
          await this.octokit.repos.deleteFile({
            owner: this.repoOwner,
            repo: this.repoName,
            path: filePath,
            message: commitMessage,
            sha: sha,
            branch: this.defaultBranch,
          });

          this.logger.log(`File ${filePath} deleted successfully.`);
          return;
        } catch (error: any) {
          if (error.status === 409 && attempt < retries) {
            this.logger.warn(
              `Conflict deleting ${filePath}. Retrying (${attempt}/${retries})...`,
            );
            const backoffTime = 1000 * Math.pow(2, attempt - 1); // 1s, 2s, 4s
            await this.delay(backoffTime);
            continue;
          }

          if (error.status === 409) {
            this.logger.error(
              `Persistent conflict deleting ${filePath}: ${error.message}`,
            );
            throw new InternalServerErrorException(
              `Error deleting file ${filePath}: ${error.message}`,
            );
          }

          if (isOctokitResponseError(error) && error.status === 404) {
            this.logger.warn(
              `The file ${filePath} does not exist in the repository.`,
            );
            return;
          }

          if (isOctokitResponseError(error)) {
            this.logger.error(
              `Error deleting file ${filePath}: ${error.message} (Status: ${error.status})`,
            );
          } else {
            this.logger.error(`Error deleting file ${filePath}: ${error}`);
          }
          throw error;
        }
      }
    } catch (error) {
      this.logger.error(`Error deleting file ${filePath}: ${error}`);
      throw error;
    }
  }

  /**
   * Get the content of a file.
   * @param filePath Path of the file in the repository.
   * @returns Plain text file content or null if it does not exist.
   */
  async getFileContent(filePath: string): Promise<string | null> {
    try {
      const { data } = await this.octokit.repos.getContent({
        owner: this.repoOwner,
        repo: this.repoName,
        path: filePath,
        ref: this.defaultBranch,
      });

      if ('content' in data && data.content) {
        const buffer = Buffer.from(data.content, 'base64');
        return buffer.toString('utf-8');
      }

      return null;
    } catch (error: any) {
      if (isOctokitResponseError(error)) {
        if (error.status === 404) {
          return null;
        }
      }
      if (isOctokitResponseError(error)) {
        this.logger.error(
          `Error getting content of file ${filePath}: ${error.message} (Status: ${error.status})`,
        );
      } else {
        this.logger.error(
          `Error getting content of file ${filePath}: ${error}`,
        );
      }
      throw error;
    }
  }

  /**
   * Lists the files in a specific directory on GitHub.
   * @param directoryPath Path of the directory in the repository.
   * @returns Array of file names.
   */
  async listFilesInDirectory(directoryPath: string): Promise<string[]> {
    try {
      const { data } = await this.octokit.repos.getContent({
        owner: this.repoOwner,
        repo: this.repoName,
        path: directoryPath,
        ref: this.defaultBranch,
      });

      if (Array.isArray(data)) {
        return data.map((file) => file.name);
      }

      return [];
    } catch (error: any) {
      if (isOctokitResponseError(error) && error.status === 404) {
        this.logger.warn(`The directory ${directoryPath} does not exist.`);
        return [];
      }

      if (isOctokitResponseError(error)) {
        this.logger.error(
          `Error listing files in ${directoryPath}: ${error.message} (Status: ${error.status})`,
        );
      } else {
        this.logger.error(`Error listing files in ${directoryPath}: ${error}`);
      }
      throw error;
    }
  }

  /**
   * Clears all files in the GitHub repository.
   * Useful for cleaning the state before running tests.
   */
  async clearRepository(): Promise<void> {
    this.logger.log('Starting GitHub repository cleanup...');

    try {
      const files = await this.listAllFiles();

      for (const file of files) {
        // Do not delete essential files like .gitignore or .gitkeep
        if (
          file.path === '.gitignore' ||
          path.basename(file.path) === '.gitkeep'
        ) {
          continue;
        }

        await this.deleteFile(
          file.path,
          `Clear repository: Remove ${file.path}`,
        );
      }

      this.logger.log('GitHub repository cleaned successfully.');
    } catch (error: any) {
      this.logger.error(`Error cleaning the repository: ${error.message}`);
      throw new InternalServerErrorException(
        `Error cleaning the repository: ${error.message}`,
      );
    }
  }

  /**
   * Recursively lists all files in the GitHub repository.
   * @returns List of file paths in the repository.
   */
  private async listAllFiles(): Promise<Array<{ path: string }>> {
    const rootPath = '';
    const files: Array<{ path: string }> = [];

    async function traverseDirectory(
      service: GitHubService,
      currentPath: string,
      accumulator: Array<{ path: string }>,
    ): Promise<void> {
      try {
        const response = await service.octokit.repos.getContent({
          owner: service.repoOwner,
          repo: service.repoName,
          path: currentPath,
          ref: service.defaultBranch,
        });

        if (Array.isArray(response.data)) {
          for (const file of response.data) {
            if (file.type === 'file') {
              accumulator.push({ path: file.path });
            } else if (file.type === 'dir') {
              await traverseDirectory(service, file.path, accumulator);
            }
          }
        }
      } catch (error: any) {
        if (isOctokitResponseError(error) && error.status === 404) {
          service.logger.warn(`Directory ${currentPath} does not exist.`);
        } else {
          service.logger.error(
            `Error listing files in ${currentPath}: ${error.message} (Status: ${error.status})`,
          );
          throw new InternalServerErrorException(
            `Error listing files in ${currentPath}: ${error.message}`,
          );
        }
      }
    }

    await traverseDirectory(this, rootPath, files);
    return files;
  }

  /**
   * Introduces a delay during tests.
   * @param ms Milliseconds to pause.
   */
  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Simple directory lock implementation to prevent concurrent operations.
   * @param directoryPath Path of the directory to lock.
   */
  private async lockDirectory(directoryPath: string): Promise<void> {
    while (this.directoryLocks.get(directoryPath)) {
      this.logger.warn(`Directory ${directoryPath} is locked. Waiting...`);
      await this.delay(100); // Wait 100ms before retrying
    }
    this.directoryLocks.set(directoryPath, true);
  }

  /**
   * Unlocks a directory after completing operations.
   * @param directoryPath Path of the directory to unlock.
   */
  private unlockDirectory(directoryPath: string): void {
    this.directoryLocks.set(directoryPath, false);
    this.logger.log(`Directory ${directoryPath} unlocked.`);
  }
}
