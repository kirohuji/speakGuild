import type { GameMapData } from "../../api-content-admin";

export type RoomLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ExplorationObjectKind =
  | "vocabulary"
  | "reading"
  | "listening"
  | "clue"
  | "quest";

export type ExplorationObject = {
  id: string;
  roomId: string;
  title: string;
  english: string;
  translation: string;
  pronunciation?: string;
  example?: string;
  prompt?: string;
  imageUrl?: string;
  kind: ExplorationObjectKind;
  x: number;
  y: number;
  width: number;
  height: number;
  required: boolean;
  hidden: boolean;
};

export type ExplorationEditorData = {
  version: 3;
  explorationScenes?: Record<string, Record<string, RoomLayout>>;
  explorationObjects?: Record<string, ExplorationObject[]>;
  preview?: {
    timeOfDay?: "day" | "golden" | "night";
    initialZoom?: number;
  };
  [key: string]: unknown;
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
    version: Math.max(Number(current.version) || 0, 3),
    explorationScenes: {
      ...(current.explorationScenes ?? {}),
      [locationId]: {
        ...(current.explorationScenes?.[locationId] ?? {}),
        [roomId]: layout,
      },
    },
  };
}

export function getExplorationObjects(
  map: GameMapData | null,
  roomId: string,
): ExplorationObject[] {
  const items = map?.editorData?.explorationObjects?.[roomId];
  if (!Array.isArray(items)) return [];
  return items.filter(
    (item): item is ExplorationObject =>
      !!item &&
      typeof item === "object" &&
      typeof item.id === "string" &&
      typeof item.title === "string",
  );
}

export function upsertExplorationObject(
  editorData: any,
  roomId: string,
  object: ExplorationObject,
): ExplorationEditorData {
  const current = (editorData ?? {}) as ExplorationEditorData;
  const roomObjects = Array.isArray(current.explorationObjects?.[roomId])
    ? current.explorationObjects![roomId]
    : [];
  const exists = roomObjects.some((item) => item.id === object.id);
  return {
    ...current,
    version: 3,
    explorationObjects: {
      ...(current.explorationObjects ?? {}),
      [roomId]: exists
        ? roomObjects.map((item) => (item.id === object.id ? object : item))
        : [...roomObjects, object],
    },
  };
}

export function removeExplorationObject(
  editorData: any,
  roomId: string,
  objectId: string,
): ExplorationEditorData {
  const current = (editorData ?? {}) as ExplorationEditorData;
  return {
    ...current,
    version: 3,
    explorationObjects: {
      ...(current.explorationObjects ?? {}),
      [roomId]: getRoomObjectsFromEditorData(current, roomId).filter(
        (item) => item.id !== objectId,
      ),
    },
  };
}

export function updateExplorationObjectPosition(
  editorData: any,
  roomId: string,
  objectId: string,
  x: number,
  y: number,
): ExplorationEditorData {
  const current = (editorData ?? {}) as ExplorationEditorData;
  return {
    ...current,
    version: 3,
    explorationObjects: {
      ...(current.explorationObjects ?? {}),
      [roomId]: getRoomObjectsFromEditorData(current, roomId).map((item) =>
        item.id === objectId ? { ...item, x, y } : item,
      ),
    },
  };
}

function getRoomObjectsFromEditorData(
  editorData: ExplorationEditorData,
  roomId: string,
) {
  const items = editorData.explorationObjects?.[roomId];
  return Array.isArray(items) ? items : [];
}
