import type { GameMapData } from "../../api-content-admin";

export type RoomLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function makeExplorationKey(value: string, prefix: string) {
  const key = value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return key || `${prefix}_${Date.now().toString(36)}`;
}

export function getRoomLayout(
  map: GameMapData | null,
  locationId: string,
  roomId: string,
  index: number,
): RoomLayout {
  const stored = map?.editorData?.explorationScenes?.[locationId]?.[roomId];
  return stored && typeof stored === "object"
    ? {
        x: stored.x ?? 24,
        y: stored.y ?? 28,
        width: stored.width ?? 180,
        height: stored.height ?? 120,
      }
    : {
        x: 22 + (index % 3) * 28,
        y: 28 + Math.floor(index / 3) * 30,
        width: 180,
        height: 120,
      };
}

export function updateRoomLayout(
  editorData: any,
  locationId: string,
  roomId: string,
  layout: RoomLayout,
) {
  const current = editorData ?? {};
  return {
    ...current,
    version: 2,
    explorationScenes: {
      ...(current.explorationScenes ?? {}),
      [locationId]: {
        ...(current.explorationScenes?.[locationId] ?? {}),
        [roomId]: layout,
      },
    },
  };
}
