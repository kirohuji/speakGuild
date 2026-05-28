import * as PIXI from 'pixi.js';

export type Updatable = PIXI.Container & { update(dt: number, w: number, h: number): boolean };

export interface ThemeSetup {
  items: Updatable[];
  onTick: (dt: number, w: number, h: number, items: Updatable[]) => void;
}
