import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { RicesService } from './rices.service';

import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';

@ApiTags('rices')
@Controller('rices')
export class RicesController {
  constructor(private readonly ricesService: RicesService) {}

  @ApiOperation({ summary: 'Upload a new Rice' })
  @ApiResponse({ status: 201, description: 'Rice successfully created.' })
  @ApiHeader({
    name: 'X-Zen-Rice-Name',
    description: 'Name of the rice',
    required: true,
  })
  @ApiHeader({
    name: 'X-Zen-Rice-Author',
    description: 'Author of the rice',
    required: true,
  })
  @ApiHeader({
    name: 'User-Agent',
    description: 'User-Agent',
    required: true,
  })
  @Post()
  async createRice(
    @Body() content: string,
    @Headers() headers: Record<string, string>,
    @Headers('x-zen-rices-token') token: string,
  ) {
    const contentString =
      typeof content === 'string' ? content : JSON.stringify(content);
    return this.ricesService.create(contentString, token, headers);
  }

  @ApiOperation({ summary: 'Get information about a Rice' })
  @ApiResponse({ status: 200, description: 'Returns metadata of the Rice.' })
  @Get(':slug')
  /*************  ✨ Codeium Command ⭐  *************/
  /**
   * Retrieve metadata of a rice with the given slug.
   * @param slug Slug of the rice.
   * @returns Metadata of the rice if found, otherwise throws a NotFoundException.
   */
  /******  c6f70808-e78d-4b17-a285-d2fd79527659  *******/
  async getRice(@Param('slug') slug: string) {
    return this.ricesService.findOne(slug);
  }

  @ApiOperation({ summary: 'Update an existing Rice' })
  @ApiResponse({ status: 200, description: 'Rice successfully updated.' })
  @ApiHeader({
    name: 'X-Zen-Rice-Name',
    description: 'Name of the rice',
    required: true,
  })
  @ApiHeader({
    name: 'X-Zen-Rice-Author',
    description: 'Author of the rice',
    required: true,
  })
  @ApiHeader({
    name: 'User-Agent',
    description: 'User-Agent',
    required: true,
  })
  @Put(':slug')
  async updateRice(
    @Param('slug') slug: string,
    @Body() content: string,
    @Headers() headers: Record<string, string>,
    @Headers('x-zen-rices-token') token: string,
  ) {
    const contentString =
      typeof content === 'string' ? content : JSON.stringify(content);
    return this.ricesService.update(slug, token, contentString, headers);
  }

  @ApiOperation({ summary: 'Delete an existing Rice' })
  @ApiResponse({ status: 204, description: 'Rice successfully deleted.' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':slug')
  async removeRice(
    @Param('slug') slug: string,
    @Headers('x-zen-rices-token') token: string,
  ) {
    await this.ricesService.remove(slug, token);
    return;
  }

  @ApiOperation({
    summary: 'Forcefully delete a Rice (moderation)',
    description:
      'Requires knowledge of a moderation secret to delete the Rice.',
  })
  @ApiResponse({ status: 204, description: 'Rice deleted by moderation.' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('moderate/delete/:slug')
  async removeRiceByModerator(
    @Param('slug') slug: string,
    @Headers('x-moderation-secret') moderationSecret: string,
  ) {
    if (moderationSecret !== process.env.MODERATION_SECRET) {
      throw new UnauthorizedException('Invalid moderation secret');
    }
    await this.ricesService.moderateRemove(slug);
    return;
  }
}
