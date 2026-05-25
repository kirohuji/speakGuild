import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ExplorationService } from './exploration.service';
import { MapService } from './map/map.service';
import { CharacterService } from './character/character.service';
import { InkScriptService } from './ink/ink-script.service';
import { GameSaveService } from './game-save/game-save.service';
import { requireAuthSession } from '../auth/session.util';

@Controller('explore')
export class ExplorationController {
  constructor(
    private readonly explorationService: ExplorationService,
    private readonly mapService: MapService,
    private readonly characterService: CharacterService,
    private readonly inkService: InkScriptService,
    private readonly gameSaveService: GameSaveService,
  ) {}

  // ---- 地图 ----
  @Get('maps')
  async getMaps(@Req() req: Request) {
    const session = await requireAuthSession(req);
    return this.mapService.getAllMaps(session.user.id);
  }

  @Get('maps/:id')
  async getMap(@Param('id') id: string) {
    return this.mapService.getMapDetail(id);
  }

  @Get('locations/:id')
  async getLocation(@Param('id') id: string) {
    return this.explorationService.getLocationDetail(id);
  }

  // ---- 角色 ----
  @Get('characters')
  async getCharacters() {
    return this.characterService.getAllCharacters();
  }

  @Get('characters/:id')
  async getCharacter(@Param('id') id: string) {
    return this.characterService.getCharacterDetail(id);
  }

  // ---- Ink 剧本 ----
  @Get('ink/:key')
  async getInkScript(@Param('key') key: string) {
    return this.inkService.getByKey(key);
  }

  @Get('ink/:key/variables')
  async getInkVariables(@Param('key') key: string) {
    return this.inkService.getVariables(key);
  }

  // ---- 游戏存档 ----
  @Get('saves')
  async getSaves(@Req() req: Request) {
    const session = await requireAuthSession(req);
    return this.gameSaveService.listSaves(session.user.id);
  }

  @Get('saves/:slot')
  async getSave(@Req() req: Request, @Param('slot') slot: string) {
    const session = await requireAuthSession(req);
    return this.gameSaveService.getSave(session.user.id, parseInt(slot));
  }

  @Post('saves/:slot')
  async saveGame(
    @Req() req: Request,
    @Param('slot') slot: string,
    @Body() body: any,
  ) {
    const session = await requireAuthSession(req);
    return this.gameSaveService.saveGame(session.user.id, parseInt(slot), body);
  }

  @Post('saves/:slot/delete')
  async deleteSave(@Req() req: Request, @Param('slot') slot: string) {
    const session = await requireAuthSession(req);
    return this.gameSaveService.deleteSave(session.user.id, parseInt(slot));
  }

  // ---- 自由对话 ----
  @Get('dialogues')
  async getDialogues(
    @Req() req: Request,
    @Query('characterId') characterId?: string,
  ) {
    const session = await requireAuthSession(req);
    return this.explorationService.getDialogues(session.user.id, characterId);
  }

  @Post('dialogues')
  async createDialogue(@Req() req: Request, @Body() body: any) {
    const session = await requireAuthSession(req);
    return this.explorationService.createDialogue(session.user.id, body);
  }
}
