import { Module } from '@nestjs/common';
import { ScriptController } from './script.controller';
import { ScriptService } from './script.service';
import { ScriptJudgeService } from './script-judge.service';

@Module({
  controllers: [ScriptController],
  providers: [ScriptService, ScriptJudgeService],
  exports: [ScriptService],
})
export class ScriptModule {}
