import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UploadedFile,
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
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

@ApiTags('rices')
@Controller('rices')
export class RicesController {
  constructor(private readonly ricesService: RicesService) {}

  @ApiOperation({ summary: 'Upload a new Rice' })
  @ApiResponse({ status: 201, description: 'Rice successfully created.' })
  @ApiConsumes('multipart/form-data')
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async createRice(
    @Body() createRiceDto: CreateRiceDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.ricesService.create(createRiceDto, file);
  }

  @ApiOperation({ summary: 'Get information about a Rice' })
  @ApiResponse({ status: 200, description: 'Returns metadata of the Rice.' })
  @Get(':identifier')
  async getRice(@Param('identifier') identifier: string) {
    return this.ricesService.findOne(identifier);
  }

  @ApiOperation({ summary: 'Update an existing Rice' })
  @ApiResponse({ status: 200, description: 'Rice successfully updated.' })
  @ApiConsumes('multipart/form-data')
  @Put(':identifier')
  @UseInterceptors(FileInterceptor('file'))
  async updateRice(
    @Param('identifier') identifier: string,
    @Headers('x-rices-token') token: string,
    @Body() updateRiceDto: UpdateRiceDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.ricesService.update(identifier, token, updateRiceDto, file);
  }

  @ApiOperation({ summary: 'Delete an existing Rice' })
  @ApiResponse({ status: 204, description: 'Rice successfully deleted.' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':identifier')
  async removeRice(
    @Param('identifier') identifier: string,
    @Headers('x-rices-token') token: string,
  ) {
    await this.ricesService.remove(identifier, token);
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
  @Delete('moderate/delete/:identifier')
  async removeRiceByModerator(
    @Param('identifier') identifier: string,
    @Headers('x-moderation-secret') moderationSecret: string,
  ) {
    // Verify the secret
    if (moderationSecret !== process.env.MODERATION_SECRET) {
      throw new UnauthorizedException('Invalid moderation secret');
    }

    // Call the service to delete without a token
    await this.ricesService.moderateRemove(identifier);
    return;
  }
}
