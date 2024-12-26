import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseInterceptors,
  Headers,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RicesService } from './rices.service';
import { CreateRiceDto } from './dto/create-rice.dto';
import { UpdateRiceDto } from './dto/update-rice.dto';

import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';

@ApiTags('rices')
@Controller('rices')
export class RicesController {
  constructor(private readonly ricesService: RicesService) {}

  @ApiOperation({ summary: 'Upload a new Rice' })
  @ApiResponse({ status: 201, description: 'Rice successfully created.' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Data required to create a rice',
    schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name of the rice',
          example: 'My First Rice',
        },
        content: {
          type: 'string',
          description: 'The JSON content to upload',
        },
      },
    },
  })
  @Post()
  async createRice(@Body() createRiceDto: CreateRiceDto) {
    return this.ricesService.create(createRiceDto);
  }

  @ApiOperation({ summary: 'Get information about a Rice' })
  @ApiResponse({ status: 200, description: 'Returns metadata of the Rice.' })
  @Get(':slug')
  async getRice(@Param('slug') slug: string) {
    return this.ricesService.findOne(slug);
  }

  @ApiOperation({ summary: 'Update an existing Rice' })
  @ApiResponse({ status: 200, description: 'Rice successfully updated.' })
  @ApiConsumes('multipart/form-data')
  @Put(':slug')
  @UseInterceptors(FileInterceptor('file'))
  async updateRice(
    @Param('slug') slug: string,
    @Headers('x-rices-token') token: string,
    @Body() updateRiceDto: UpdateRiceDto,
  ) {
    return this.ricesService.update(slug, token, updateRiceDto);
  }

  @ApiOperation({ summary: 'Delete an existing Rice' })
  @ApiResponse({ status: 204, description: 'Rice successfully deleted.' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':slug')
  async removeRice(
    @Param('slug') slug: string,
    @Headers('x-rices-token') token: string,
  ) {
    await this.ricesService.remove(slug, token);
    return;
  }

  // =========================================
  // NEW ENDPOINT FOR MODERATION DELETION
  // =========================================
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
    // Verify the secret
    if (moderationSecret !== process.env.MODERATION_SECRET) {
      throw new UnauthorizedException('Invalid moderation secret');
    }

    // Call the service to delete without a token
    await this.ricesService.moderateRemove(slug);
    return;
  }
}
