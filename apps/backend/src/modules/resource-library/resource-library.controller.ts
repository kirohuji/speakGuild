import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { ResourceLibraryService, TreeNode } from './resource-library.service';
import { CreateResourceNodeDto } from './dto/create-resource-node.dto';
import { UpdateResourceNodeDto } from './dto/update-resource-node.dto';
import { MoveResourceNodeDto } from './dto/move-resource-node.dto';

@Controller('admin/resources')
export class ResourceLibraryController {
  constructor(private readonly resourceLibraryService: ResourceLibraryService) {}

  @Get('tree')
  getTree(@Query('region') region?: string): Promise<TreeNode[]> {
    return this.resourceLibraryService.getTree(region);
  }

  @Get('regions')
  getRegions(): Promise<string[]> {
    return this.resourceLibraryService.getRegions();
  }

  @Get(':id')
  getNode(@Param('id') id: string): Promise<TreeNode> {
    return this.resourceLibraryService.getNode(id);
  }

  @Post()
  createNode(@Body() dto: CreateResourceNodeDto) {
    return this.resourceLibraryService.createNode(dto);
  }

  @Patch(':id')
  updateNode(@Param('id') id: string, @Body() dto: UpdateResourceNodeDto) {
    return this.resourceLibraryService.updateNode(id, dto);
  }

  @Delete(':id')
  deleteNode(@Param('id') id: string) {
    return this.resourceLibraryService.deleteNode(id);
  }

  @Patch(':id/move')
  moveNode(@Param('id') id: string, @Body() dto: MoveResourceNodeDto) {
    return this.resourceLibraryService.moveNode(id, dto);
  }
}
