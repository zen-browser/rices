// src/rices/rices.service.ts

import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateRiceDto } from './dto/create-rice.dto';
import { UpdateRiceDto } from './dto/update-rice.dto';
import { v4 as uuidv4 } from 'uuid';
import { generateSlug } from './utils/slug.util';
import { GitHubService } from '../github/github.service';

/**
 * Checks if the provided error has a 'status' property of type 'number'
 * and a 'message' property of type 'string'.
 */
function isOctokitResponseError(
  error: unknown,
): error is { status: number; message: string } {
  return (
    error !== null &&
    typeof error === 'object' &&
    'status' in error &&
    typeof (error as any).status === 'number' &&
    'message' in error &&
    typeof (error as any).message === 'string'
  );
}

@Injectable()
export class RicesService {
  constructor(private readonly gitHubService: GitHubService) {}

  /**
   * Create a new rice
   */
  async create(createRiceDto: CreateRiceDto, file?: Express.Multer.File) {
    try {
      // 1. Generate identifier (slug + UUID or just UUID)
      let identifier: string;
      if (createRiceDto.name) {
        // Generate slug from the name
        const slug = generateSlug(createRiceDto.name);
        identifier = `${slug}-${uuidv4()}`;
      } else {
        identifier = uuidv4();
      }

      // 2. Generate token and save metadata
      const token = uuidv4();
      const metadata = {
        id: identifier,
        token,
        name: createRiceDto.name || null,
        createdAt: new Date().toISOString(),
      };
      const metadataContent = JSON.stringify(metadata, null, 2);
      const riceJsonPath = `rices/${identifier}/rice.json`;

      // 3. Create or update rice.json in GitHub
      await this.gitHubService.createOrUpdateFile(
        riceJsonPath,
        metadataContent,
        `Add rice ${identifier}`,
      );

      // 4. If there's a file, upload it to GitHub
      if (file && file.originalname && file.buffer) {
        const fileContent = file.buffer.toString('utf-8');
        const uploadedFilePath = `rices/${identifier}/data.zenrice`;
        await this.gitHubService.createOrUpdateFile(
          uploadedFilePath,
          fileContent,
          `Add file ${file.originalname} to rice ${identifier}/data.zenrice`,
        );
      }

      // 5. Return identifier and token
      return {
        identifier,
        token,
      };
    } catch (error) {
      console.error('Error creating the rice:', error);
      throw new Error('Failed to create rice');
    }
  }

  /**
   * Get rice information by its identifier
   */
  async findOne(identifier: string) {
    try {
      const riceJsonPath = `rices/${identifier}/data.zenrice`;
      const fileContent = await this.gitHubService.getFileContent(riceJsonPath);

      if (!fileContent) {
        throw new NotFoundException('Rice not found');
      }

      return fileContent;
    } catch (error) {
      if (isOctokitResponseError(error) && error.status === 404) {
        throw new NotFoundException('Rice not found');
      }
      console.error('Error getting the rice:', error);
      throw new Error('Failed to get rice');
    }
  }

  /**
   * Update an existing rice
   */
  async update(
    identifier: string,
    token: string,
    updateRiceDto: UpdateRiceDto,
    file?: Express.Multer.File,
  ) {
    try {
      // 1. Retrieve and validate metadata
      const riceJsonPath = `rices/${identifier}/rice.json`;
      const metadataContent =
        await this.gitHubService.getFileContent(riceJsonPath);

      if (!metadataContent) {
        throw new NotFoundException('Rice not found');
      }

      const metadata = JSON.parse(metadataContent);

      if (metadata.token !== token) {
        throw new UnauthorizedException('Invalid token');
      }

      // 2. Update metadata
      if (updateRiceDto.name) {
        metadata.name = updateRiceDto.name;
      }
      metadata.updatedAt = new Date().toISOString();
      const updatedMetadataContent = JSON.stringify(metadata, null, 2);

      // 3. Update rice.json in GitHub
      await this.gitHubService.createOrUpdateFile(
        riceJsonPath,
        updatedMetadataContent,
        `Update rice ${identifier}`,
      );

      // 4. If there's a file, update it in GitHub
      if (file && file.originalname && file.buffer) {
        const fileContent = file.buffer.toString('utf-8');
        const uploadedFilePath = `rices/${identifier}/data.zenrice`;
        await this.gitHubService.createOrUpdateFile(
          uploadedFilePath,
          fileContent,
          `Update file ${file.originalname} in rice ${identifier}/data.zenrice`,
        );
      }

      return {
        message: `Rice ${identifier} updated`,
      };
    } catch (error) {
      if (isOctokitResponseError(error)) {
        if (error.status === 404) {
          throw new NotFoundException('Rice not found');
        }
        if (error.status === 401 || error.status === 403) {
          throw new UnauthorizedException('Invalid token');
        }
      }
      console.error('Error updating the rice:', error);
      throw new Error('Failed to update rice');
    }
  }

  /**
   * Delete an existing rice
   */
  async remove(identifier: string, token: string): Promise<void> {
    try {
      // 1. Retrieve and validate metadata
      const riceJsonPath = `rices/${identifier}/rice.json`;
      const metadataContent =
        await this.gitHubService.getFileContent(riceJsonPath);

      if (!metadataContent) {
        throw new NotFoundException('Rice not found');
      }

      const metadata = JSON.parse(metadataContent);

      if (metadata.token !== token) {
        throw new UnauthorizedException('Invalid token');
      }

      // 2. Delete rice.json from GitHub
      await this.gitHubService.deleteFile(
        riceJsonPath,
        `Remove rice ${identifier}`,
      );

      // 3. List and delete uploaded files (if any)
      const uploadedFilesPath = `rices/${identifier}`;
      const files =
        await this.gitHubService.listFilesInDirectory(uploadedFilesPath);

      for (const file of files) {
        if (file !== 'rice.json') {
          const filePath = `rices/${identifier}/${file}`;
          await this.gitHubService.deleteFile(
            filePath,
            `Remove file ${file} from rice ${identifier}`,
          );
        }
      }
    } catch (error) {
      if (isOctokitResponseError(error)) {
        if (error.status === 404) {
          throw new NotFoundException('Rice not found');
        }
        if (error.status === 401 || error.status === 403) {
          throw new UnauthorizedException('Invalid token');
        }
      }
      console.error('Error deleting the rice:', error);
      throw new Error('Failed to remove rice');
    }
  }

  /**
   * Delete a rice without checking the user's token.
   * Exclusive use for moderators with the secret key.
   */
  public async moderateRemove(identifier: string): Promise<void> {
    try {
      // 1. Check if rice.json exists
      const riceJsonPath = `rices/${identifier}/rice.json`;
      const metadataContent =
        await this.gitHubService.getFileContent(riceJsonPath);

      if (!metadataContent) {
        throw new NotFoundException('Rice not found');
      }

      // 2. Delete rice.json from GitHub
      await this.gitHubService.deleteFile(
        riceJsonPath,
        `[MODERATION] Remove rice ${identifier}`,
      );

      // 3. List and delete uploaded files (if any)
      const uploadedFilesPath = `rices/${identifier}`;
      const files =
        await this.gitHubService.listFilesInDirectory(uploadedFilesPath);

      for (const file of files) {
        if (file !== 'rice.json') {
          const filePath = `rices/${identifier}/${file}`;
          await this.gitHubService.deleteFile(
            filePath,
            `[MODERATION] Remove file ${file} from rice ${identifier}`,
          );
        }
      }
    } catch (error) {
      if (isOctokitResponseError(error)) {
        if (error.status === 404) {
          throw new NotFoundException('Rice not found');
        }
        if (error.status === 401 || error.status === 403) {
          throw new UnauthorizedException('Invalid token');
        }
      }
      console.error('Error removing rice by moderation:', error);
      throw new Error('Failed to remove rice by moderation');
    }
  }

  /**
   * List files in a specific directory in GitHub
   */
  private async listFilesInDirectory(pathInRepo: string): Promise<string[]> {
    try {
      return await this.gitHubService.listFilesInDirectory(pathInRepo);
    } catch (error) {
      if (isOctokitResponseError(error) && error.status === 404) {
        return [];
      }
      console.error(`Error listing files in ${pathInRepo}:`, error);
      throw new Error('Failed to list files in directory');
    }
  }
}
