import { Module } from '@nestjs/common';
import { ResourceLibraryController } from './resource-library.controller';
import { ResourceLibraryService } from './resource-library.service';
import { FileAssetsModule } from '../file-assets/file-assets.module';

@Module({
  imports: [FileAssetsModule],
  controllers: [ResourceLibraryController],
  providers: [ResourceLibraryService],
})
export class ResourceLibraryModule {}
