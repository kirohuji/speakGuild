import { Module } from '@nestjs/common';
import { ExplorationController } from './exploration.controller';
import { ExplorationService } from './exploration.service';
import { MapService } from './map/map.service';
import { CharacterService } from './character/character.service';
import { InkScriptService } from './ink/ink-script.service';
import { GameSaveService } from './game-save/game-save.service';
import { ExplorationDialogueService } from './dialogue/exploration-dialogue.service';

@Module({
  controllers: [ExplorationController],
  providers: [
    ExplorationService,
    MapService,
    CharacterService,
    InkScriptService,
    GameSaveService,
    ExplorationDialogueService,
  ],
  exports: [ExplorationService],
})
export class ExplorationModule {}
