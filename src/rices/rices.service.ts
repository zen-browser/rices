import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { CreateRiceDto } from './dto/create-rice.dto';
import { UpdateRiceDto } from './dto/update-rice.dto';
import { v4 as uuidv4 } from 'uuid';
import { generateSlug } from './utils/slug.util';
import { GitHubService } from '../github/github.service';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class RicesService {
  constructor(
    private readonly gitHubService: GitHubService,
    private readonly supabaseService: SupabaseService,
  ) {}

  async create(createRiceDto: CreateRiceDto) {
    // Check if a rice with the same name already exists
    const existingRice = await this.supabaseService.getRiceByName(
      createRiceDto.name,
    );
    if (existingRice) {
      throw new ConflictException(
        `A rice with the name '${createRiceDto.name}' already exists.`,
      );
    }

    const slug = createRiceDto.name
      ? `${generateSlug(createRiceDto.name)}-${uuidv4()}`
      : uuidv4();

    const token = uuidv4();

    const encodedContent = Buffer.from(
      JSON.stringify(createRiceDto.content),
    ).toString('base64');

    const metadata = {
      id: uuidv4(),
      token,
      name: createRiceDto.name || null,
      slug: slug,
      visits: 0,
      level: 0,
      created_at: new Date().toISOString(),
    };

    await this.supabaseService.insertRice(metadata);

    const metadataContent = JSON.stringify(metadata, null, 2);
    const riceJsonPath = `rices/${slug}/rice.json`;
    await this.gitHubService.createOrUpdateFile(
      riceJsonPath,
      metadataContent,
      `Add rice ${slug}`,
    );

    if (createRiceDto.content) {
      const uploadedFilePath = `rices/${slug}/data.zenrice`;
      await this.gitHubService.createOrUpdateFile(
        uploadedFilePath,
        encodedContent,
        `Add file createRiceDto.content to rice ${slug}`,
      );
    }

    return { slug, token };
  }

  async findOne(slug: string) {
    // Check if the rice exists in the database
    const rice = await this.supabaseService.getRiceBySlug(slug);
    if (!rice) throw new NotFoundException('Rice not found');

    // Fetch the file from GitHub
    const filePath = `rices/${slug}/data.zenrice`;
    const fileContent = await this.gitHubService.getFileContent(filePath);

    if (!fileContent) {
      throw new NotFoundException('Rice file not found in GitHub');
    }

    // Decode Base64 content
    const contentPrev = Buffer.from(fileContent, 'base64').toString('utf-8');

    // Remove unescaped double quotes at the beginning and end, if present
    const content = contentPrev.replace(/^"|"$/g, '');

    return { slug, content };
  }

  async update(slug: string, token: string, updateRiceDto: UpdateRiceDto) {
    /*************  ✨ Codeium Command ⭐  *************/
    /**
     * Updates the metadata and content of a rice entry identified by its slug.
     *
     * @param slug - The unique identifier for the rice entry.
     * @param token - The authorization token to verify the request.
     * @param updateRiceDto - Data Transfer Object containing fields to update.
     *
     * @returns A confirmation message indicating successful update.
     *
     * @throws NotFoundException - If the rice entry does not exist.
     * @throws UnauthorizedException - If the provided token is invalid.
     */
    /******  bf5f61f3-c1dc-40a0-85e6-288824144ead  *******/ const rice =
      await this.supabaseService.getRiceBySlug(slug);
    if (!rice) throw new NotFoundException('Rice not found');
    if (rice.token !== token) throw new UnauthorizedException('Invalid token');

    const updatedMetadata = {
      ...rice,
      updated_at: new Date().toISOString(),
    };

    await this.supabaseService.updateRice(slug, updatedMetadata);

    const metadataContent = JSON.stringify(updatedMetadata, null, 2);
    const riceJsonPath = `rices/${slug}/rice.json`;
    await this.gitHubService.createOrUpdateFile(
      riceJsonPath,
      metadataContent,
      `Update rice ${slug}`,
    );

    if (updateRiceDto.content) {
      const encodedContent = Buffer.from(
        JSON.stringify(updateRiceDto.content),
      ).toString('base64');

      const uploadedFilePath = `rices/${slug}/data.zenrice`;
      await this.gitHubService.createOrUpdateFile(
        uploadedFilePath,
        encodedContent,
        `Update file updateRiceDto.content in rice ${slug}`,
      );
    }

    return { message: `ok` };
  }

  async remove(slug: string, token: string): Promise<void> {
    const rice = await this.supabaseService.getRiceBySlug(slug);
    if (!rice) throw new NotFoundException('Rice not found');
    if (rice.token !== token) throw new UnauthorizedException('Invalid token');

    await this.supabaseService.deleteRice(slug);

    const riceJsonPath = `rices/${slug}/rice.json`;
    await this.gitHubService.deleteFile(riceJsonPath, `Remove rice ${slug}`);
  }

  /**
   * Delete a rice without checking the user's token.
   * Exclusive use for moderators with the secret key.
   */
  public async moderateRemove(slug: string): Promise<void> {
    try {
      // 1. Check if rice exists in Supabase
      const rice = await this.supabaseService.getRiceBySlug(slug);
      if (!rice) {
        throw new NotFoundException('Rice not found');
      }

      // 2. Delete metadata from Supabase
      await this.supabaseService.deleteRice(slug);

      // 3. Delete rice.json from GitHub
      const riceJsonPath = `rices/${slug}/rice.json`;
      await this.gitHubService.deleteFile(
        riceJsonPath,
        `[MODERATION] Remove rice ${slug}`,
      );

      // 4. List and delete uploaded files from GitHub (if any)
      const uploadedFilesPath = `rices/${slug}`;
      const files =
        await this.gitHubService.listFilesInDirectory(uploadedFilesPath);

      for (const file of files) {
        if (file !== 'rice.json') {
          const filePath = `rices/${slug}/${file}`;
          await this.gitHubService.deleteFile(
            filePath,
            `[MODERATION] Remove file ${file} from rice ${slug}`,
          );
        }
      }
    } catch (error) {
      console.error('Error removing rice by moderation:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new Error('Failed to remove rice by moderation');
    }
  }
}
