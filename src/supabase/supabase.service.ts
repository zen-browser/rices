import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private supabase: SupabaseClient;
  private supabase_url: string;
  private supabase_key: string;
  private readonly logger = new Logger(SupabaseService.name);

  constructor(private configService: ConfigService) {
    // Initialize properties in the constructor
    this.supabase_url = this.configService.get<string>('SUPABASE_URL') || '';
    this.supabase_key = this.configService.get<string>('SUPABASE_KEY') || '';

    this.supabase = createClient(this.supabase_url, this.supabase_key);
  }

  async insertRice(metadata: any) {
    const { error } = await this.supabase.from('rices').insert(metadata);
    if (error) {
      this.logger.error(
        `Failed to insert rice: ${error.message}`,
        error.details,
      );
      throw new Error(`Failed to insert rice: ${error.message}`);
    }
  }

  async getRiceById(id: string) {
    const { data, error } = await this.supabase
      .from('rices')
      .select('*')
      .eq('id', id)
      .single();
    if (error) {
      this.logger.error(
        `Failed to fetch rice with ID ${id}: ${error.message}`,
        error.details,
      );
      throw new Error(`Failed to fetch rice: ${error.message}`);
    }
    return data;
  }

  async getRiceBySlug(slug: string) {
    const { data, error } = await this.supabase
      .from('rices')
      .select('*')
      .eq('slug', slug)
      .single();
    if (error) {
      this.logger.error(
        `Failed to fetch rice with slug ${slug}: ${error.message}`,
        error.details,
      );
      return null;
    }
    return data;
  }

  async getRiceByName(name: string) {
    const { data, error } = await this.supabase
      .from('rices')
      .select('*')
      .eq('name', name)
      .single();
    if (error && error.code !== 'PGRST116') {
      // Handle "no rows found" separately
      this.logger.error(
        `Failed to fetch rice with name ${name}: ${error.message}`,
        error.details,
      );
      throw new Error(`Failed to fetch rice: ${error.message}`);
    }
    return data;
  }

  async updateRice(slug: string, metadata: any) {
    const { error } = await this.supabase
      .from('rices')
      .update(metadata)
      .eq('slug', slug);
    if (error) {
      this.logger.error(
        `Failed to update rice with slug ${slug}: ${error.message}`,
        error.details,
      );
      throw new Error(`Failed to update rice: ${error.message}`);
    }
  }

  async deleteRice(slug: string) {
    const { error } = await this.supabase
      .from('rices')
      .delete()
      .eq('slug', slug);
    if (error) {
      this.logger.error(
        `Failed to delete rice with slug ${slug}: ${error.message}`,
        error.details,
      );
      throw new Error(`Failed to delete rice: ${error.message}`);
    }
  }

  async incrementVisits(slug: string) {
    const { error } = await this.supabase.rpc('increment_visits', {
      slug_param: slug,
    });

    if (error) {
      this.logger.error(
        `Failed to increment visits for rice with slug ${slug}: ${error.message}`,
        error.details,
      );
      throw new Error(`Failed to increment visits: ${error.message}`);
    }
  }

  async updateLevel(slug: string, level: number) {
    const { error } = await this.supabase
      .from('rices')
      .update({ level })
      .eq('slug', slug);
    if (error) {
      this.logger.error(
        `Failed to update level for rice with slug ${slug}: ${error.message}`,
        error.details,
      );
      throw new Error(`Failed to update rice level: ${error.message}`);
    }
  }

  async countRicesByToken(token: string): Promise<number> {
    const { data, error, count } = await this.supabase
      .from('rices') // Nombre de tu tabla en Supabase
      .select('*', { count: 'exact' })
      .eq('token', token);

    if (error) {
      console.error('Error counting rices by token:', error);
      throw new Error('Failed to count rices by token');
    }

    return count || 0;
  }
}
