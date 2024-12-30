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
  BadRequestException,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
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

    this.validateFileSize(contentString); // Validate file size

    return this.ricesService.create(contentString, token, headers);
  }

  @ApiOperation({ summary: 'Get information about a Rice' })
  @ApiResponse({
    status: 200,
    description: 'Returns metadata of the Rice as HTML.',
  })
  @Get(':slug')
  async getRice(@Param('slug') slug: string, @Res() res: Response) {
    const riceMetadata = await this.ricesService.getRiceMetadata(slug);

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="robots" content="noindex">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="zen-content-verified" content="unverified">
  <meta name="zen-rice-data" data-author="${riceMetadata.author}" data-name="${riceMetadata.name}" data-id="${riceMetadata.id}">
  <title>Zen Rice - ${riceMetadata.name}</title>
</head>
<body>
  <!-- Body content is intentionally left blank -->
  <script defer>
    document.addEventListener('DOMContentLoaded', () => {
      /* Set time out so the meta tag is set after the next DOM repaint */
      setTimeout(() => {
        if (document.querySelector('meta[name="zen-content-verified"]')?.content !== 'verified') {
          window.location.replace('https://zen-browser.app/download');
        }
      });
    });
  </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(htmlContent);
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

    this.validateFileSize(contentString); // Validate file size

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

  private validateFileSize(content: string) {
    const sizeInBytes = Buffer.byteLength(content, 'utf-8');
    const maxSizeInBytes = 1 * 1024 * 512; // 1 MB
    if (sizeInBytes > maxSizeInBytes) {
      throw new BadRequestException(
        `The uploaded content exceeds the size limit of 512 KB.`,
      );
    }
  }
}
