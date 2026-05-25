import { Module } from '@nestjs/common';
import { LevelController } from './level.controller';
import { LevelService } from './level.service';
import { XpCalculatorService } from './xp-calculator.service';
import { OutputLevelService } from './output-level.service';
import { SceneReadinessService } from './scene-readiness.service';

@Module({
  controllers: [LevelController],
  providers: [LevelService, XpCalculatorService, OutputLevelService, SceneReadinessService],
  exports: [LevelService, XpCalculatorService, OutputLevelService, SceneReadinessService],
})
export class LevelModule {}
