import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
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

  async create(content: string, headers: Record<string, string>) {
    try {
      // Validate headers
      const name = headers['x-zen-rice-name'];
      const author = headers['x-zen-rice-author'];
      const userAgent = headers['user-agent'];

      if (!name || !author || !userAgent) {
        throw new BadRequestException(
          'Missing required headers: X-Zen-Rice-Name, X-Zen-Rice-Author, and User-Agent are mandatory.',
        );
      }

      // Validate content
      if (typeof content !== 'string') {
        throw new BadRequestException('The request body must be a string.');
      }

      // Validate lengths
      if (name.length > 75) {
        throw new BadRequestException(
          `The value of X-Zen-Rice-Name exceeds the maximum allowed length of 75 characters.`,
        );
      }

      if (author.length > 100) {
        throw new BadRequestException(
          `The value of X-Zen-Rice-Author exceeds the maximum allowed length of 100 characters.`,
        );
      }

      // Parse version and OS from User-Agent
      const userAgentRegex = /ZenBrowser\/(\d+\.\d+\.\d+) \((.+)\)/;
      const match = userAgent.match(userAgentRegex);

      if (!match) {
        throw new BadRequestException(
          'Invalid User-Agent format. Expected format: ZenBrowser/<version> (<OS>).',
        );
      }

      const [, version, os] = match;
      // Validate version and OS lengths
      if (version.length > 10) {
        throw new BadRequestException(
          `The version in User-Agent exceeds the maximum allowed length of 10 characters.`,
        );
      }

      if (os.length > 30) {
        throw new BadRequestException(
          `The operating system in User-Agent exceeds the maximum allowed length of 30 characters.`,
        );
      }

      // Check if a rice with the same name already exists
      const existingRice = await this.supabaseService.getRiceByName(name);
      if (existingRice) {
        throw new ConflictException(
          `A rice with the name '${name}' already exists.`,
        );
      }

      const slug = `${generateSlug(name)}-${uuidv4()}`;
      const token = uuidv4();

      const encodedContent = Buffer.from(content).toString('base64');

      const metadata = {
        id: uuidv4(),
        token,
        name,
        author,
        version,
        os,
        slug,
        visits: 0,
        level: 0,
        created_at: new Date().toISOString(),
      };

      // Insert metadata into Supabase
      await this.supabaseService.insertRice(metadata);

      const uploadedFilePath = `rices/${slug}/data.zenrice`;
      await this.gitHubService.createOrUpdateFile(
        uploadedFilePath,
        encodedContent,
        `Add content to rice ${slug}`,
      );

      return { slug, token };
    } catch (error) {
      console.error('Error in create method:', error);
      throw error;
    }
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

    return content;
  }

  async update(
    slug: string,
    token: string,
    content: string,
    headers: Record<string, string>,
  ) {
    try {
      // Extract fields from headers
      const name = headers['x-zen-rice-name'];
      const author = headers['x-zen-rice-author'];
      const userAgent = headers['user-agent'];

      if (!name || !author || !userAgent) {
        throw new BadRequestException(
          'Missing required headers: X-Zen-Rice-Name, X-Zen-Rice-Author, and User-Agent are mandatory.',
        );
      }

      // Parse version and OS from User-Agent
      const userAgentRegex = /ZenBrowser\/(\d+\.\d+\.\d+) \((.+)\)/;
      const match = userAgent.match(userAgentRegex);

      if (!match) {
        throw new BadRequestException(
          'Invalid User-Agent format. Expected format: ZenBrowser/<version> (<OS>).',
        );
      }

      const [, version, os] = match;

      // Check if the rice exists
      const rice = await this.supabaseService.getRiceBySlug(slug);
      if (!rice) {
        throw new NotFoundException('Rice not found');
      }

      // Validate token, name, and author match the existing record
      if (rice.token !== token) {
        throw new UnauthorizedException('Invalid token.');
      }

      // Validate name and author match the existing record
      if (rice.name !== name || rice.author !== author) {
        throw new UnauthorizedException(
          'Provided name and author do not match the existing record.',
        );
      }

      const updatedMetadata = {
        ...rice,
        version,
        os,
        updated_at: new Date().toISOString(),
      };

      await this.supabaseService.updateRice(slug, updatedMetadata);

      const encodedContent = Buffer.from(content).toString('base64');
      const uploadedFilePath = `rices/${slug}/data.zenrice`;
      await this.gitHubService.createOrUpdateFile(
        uploadedFilePath,
        encodedContent,
        `Update content in rice ${slug}`,
      );

      return { message: `Rice ${slug} updated successfully.` };
    } catch (error) {
      console.error('Error in update method:', error);
      throw error;
    }
  }

  async remove(slug: string, token: string): Promise<void> {
    const rice = await this.supabaseService.getRiceBySlug(slug);
    if (!rice) throw new NotFoundException('Rice not found');
    if (rice.token !== token) throw new UnauthorizedException('Invalid token');

    // Validate token, name, and author match the existing record
    if (rice.token !== token) {
      throw new UnauthorizedException('Invalid token.');
    }

    await this.supabaseService.deleteRice(slug);

    const folderPath = `rices/${slug}`;

    // List all files in the folder
    const files = await this.gitHubService.listFilesInDirectory(folderPath);

    // Delete all files within the folder
    for (const file of files) {
      const filePath = `${folderPath}/${file}`;
      await this.gitHubService.deleteFile(
        filePath,
        `Remove file ${file} in rice ${slug}`,
      );
    }

    // Finally, remove the folder itself
    await this.gitHubService.deleteFolder(
      folderPath,
      `Remove folder ${folderPath}`,
    );
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

      // 3. Delete data.zenrice from GitHub
      const riceJsonPath = `rices/${slug}/data.zenrice`;
      await this.gitHubService.deleteFile(
        riceJsonPath,
        `[MODERATION] Remove rice ${slug}`,
      );

      // 4. List and delete uploaded files from GitHub (if any)
      const filesPath = `rices/${slug}`;
      const files = await this.gitHubService.listFilesInDirectory(filesPath);

      for (const file of files) {
        const filePath = `rices/${slug}/${file}`;
        await this.gitHubService.deleteFile(
          filePath,
          `[MODERATION] Remove file ${file} from rice ${slug}`,
        );
      }

      // 4. Finally, remove the folder itself
      await this.gitHubService.deleteFolder(
        filesPath,
        `[MODERATION] Remove folder ${filesPath}`,
      );
    } catch (error) {
      console.error('Error removing rice by moderation:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new Error('Failed to remove rice by moderation');
    }
  }
}
