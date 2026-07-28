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

export type ResourceMaskPoint = {
  x: number;
  y: number;
  radius: number;
};

export type ResourceMask = {
  points: ResourceMaskPoint[];
};

export type LocationVisualStyle = {
  version?: 2;
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  warmth: number;
  shadowOpacity: number;
};

export const DEFAULT_LOCATION_VISUAL_STYLE: LocationVisualStyle = {
  version: 2,
  brightness: 1,
  contrast: 1,
  saturation: 1,
  hue: 0,
  warmth: 0,
  shadowOpacity: 0,
};

export type ExplorationLayer = {
  id: string;
  name: string;
  order: number;
  system?: "background" | "content";
};

export type SceneDimensions = {
  width: number;
  height: number;
};

export const BACKGROUND_LAYER_ID = "__background__";
export const DEFAULT_CONTENT_LAYER_ID = "__content__";

export type ExplorationEditorData = {
  version: 4;
  explorationScenes?: Record<string, Record<string, RoomLayout>>;
  explorationObjects?: Record<string, ExplorationObject[]>;
  locationMasks?: Record<string, ResourceMask>;
  locationOcclusionMasks?: Record<string, ResourceMask>;
  locationVisualStyles?: Record<string, LocationVisualStyle>;
  explorationLayers?: Record<string, ExplorationLayer[]>;
  explorationNodeLayers?: Record<string, string>;
  explorationNodeGroups?: Record<string, string>;
  sceneDimensions?: Record<string, SceneDimensions>;
  preview?: {
    timeOfDay?: "day" | "golden" | "night";
    initialZoom?: number;
    nodeBreathing?: boolean;
  };
  [key: string]: unknown;
};

export function getSceneDimensions(
  editorData: any,
  scope: string,
  fallback: SceneDimensions = { width: 1600, height: 900 },
): SceneDimensions {
  const stored = editorData?.sceneDimensions?.[scope];
  // Use stored values as-is (they may be below 320 during drafting);
  // fall back only when no stored dimension exists.
  const storedWidth = stored?.width;
  const storedHeight = stored?.height;
  return {
    width: storedWidth != null ? Math.max(1, Number(storedWidth)) : fallback.width,
    height: storedHeight != null ? Math.max(1, Number(storedHeight)) : fallback.height,
  };
}

export function updateSceneDimensions(
  editorData: any,
  scope: string,
  dimensions: SceneDimensions,
): ExplorationEditorData {
  const current = (editorData ?? {}) as ExplorationEditorData;
  return {
    ...current,
    version: 4,
    sceneDimensions: {
      ...(current.sceneDimensions ?? {}),
      [scope]: {
        // Only apply safety bounds here; business validation (min 320)
        // is handled by the caller (saveSceneDimensions).
        width: Math.max(1, Math.min(8192, Math.round(dimensions.width))),
        height: Math.max(1, Math.min(8192, Math.round(dimensions.height))),
      },
    },
  };
}

export function getExplorationLayers(
  editorData: any,
  scope: string,
): ExplorationLayer[] {
  const stored = Array.isArray(editorData?.explorationLayers?.[scope])
    ? (editorData.explorationLayers[scope] as ExplorationLayer[])
    : [];
  const content = stored.some((layer) => layer.id === DEFAULT_CONTENT_LAYER_ID)
    ? stored
    : [
        ...stored,
        {
          id: DEFAULT_CONTENT_LAYER_ID,
          name: "元素层",
          order: 1,
          system: "content" as const,
        },
      ];
  return [
    {
      id: BACKGROUND_LAYER_ID,
      name: "底图",
      order: 0,
      system: "background",
    },
    ...content
      .filter((layer) => layer.id !== BACKGROUND_LAYER_ID)
      .map((layer, index) => ({
        ...layer,
        order: index + 1,
        system:
          layer.id === DEFAULT_CONTENT_LAYER_ID ? ("content" as const) : undefined,
      })),
  ];
}

export function updateExplorationLayers(
  editorData: any,
  scope: string,
  layers: ExplorationLayer[],
): ExplorationEditorData {
  const current = (editorData ?? {}) as ExplorationEditorData;
  const contentLayers = layers
    .filter((layer) => layer.id !== BACKGROUND_LAYER_ID)
    .map((layer, index) => ({ ...layer, order: index + 1 }));
  return {
    ...current,
    version: 4,
    explorationLayers: {
      ...(current.explorationLayers ?? {}),
      [scope]: contentLayers,
    },
  };
}

export function getExplorationNodeLayerId(editorData: any, nodeId: string) {
  return (
    editorData?.explorationNodeLayers?.[nodeId] ?? DEFAULT_CONTENT_LAYER_ID
  );
}

export function updateExplorationNodeLayers(
  editorData: any,
  nodeIds: string[],
  layerId: string,
): ExplorationEditorData {
  const current = (editorData ?? {}) as ExplorationEditorData;
  const explorationNodeLayers = {
    ...(current.explorationNodeLayers ?? {}),
  };
  for (const nodeId of nodeIds) explorationNodeLayers[nodeId] = layerId;
  return {
    ...current,
    version: 4,
    explorationNodeLayers,
  };
}

export function getExplorationNodeGroupId(editorData: any, nodeId: string) {
  return editorData?.explorationNodeGroups?.[nodeId] as string | undefined;
}

export function updateExplorationNodeGroups(
  editorData: any,
  assignments: Record<string, string | undefined>,
): ExplorationEditorData {
  const current = (editorData ?? {}) as ExplorationEditorData;
  const explorationNodeGroups = {
    ...(current.explorationNodeGroups ?? {}),
  };
  for (const [nodeId, groupId] of Object.entries(assignments)) {
    if (groupId) explorationNodeGroups[nodeId] = groupId;
    else delete explorationNodeGroups[nodeId];
  }
  return {
    ...current,
    version: 4,
    explorationNodeGroups,
  };
}

export function getLocationVisualStyle(
  map: GameMapData | null,
  locationId: string,
): LocationVisualStyle {
  const stored = map?.editorData?.locationVisualStyles?.[locationId];
  return {
    ...DEFAULT_LOCATION_VISUAL_STYLE,
    ...(stored ?? {}),
    version: 2,
    shadowOpacity:
      stored?.version === 2
        ? stored.shadowOpacity
        : DEFAULT_LOCATION_VISUAL_STYLE.shadowOpacity,
  };
}

export function updateLocationVisualStyle(
  editorData: any,
  locationId: string,
  style: LocationVisualStyle,
): ExplorationEditorData {
  const current = (editorData ?? {}) as ExplorationEditorData;
  return {
    ...current,
    version: 4,
    locationVisualStyles: {
      ...(current.locationVisualStyles ?? {}),
      [locationId]: style,
    },
  };
}

export function getLocationMask(
  map: GameMapData | null,
  locationId: string,
): ResourceMask | undefined {
  const mask = map?.editorData?.locationMasks?.[locationId];
  if (!mask || !Array.isArray(mask.points)) return undefined;
  return mask;
}

export function getLocationOcclusionMask(
  map: GameMapData | null,
  locationId: string,
): ResourceMask | undefined {
  const mask = map?.editorData?.locationOcclusionMasks?.[locationId];
  if (!mask || !Array.isArray(mask.points)) return undefined;
  return mask;
}

export function updateLocationOcclusionMask(
  editorData: any,
  locationId: string,
  mask?: ResourceMask,
): ExplorationEditorData {
  const current = (editorData ?? {}) as ExplorationEditorData;
  const locationOcclusionMasks = {
    ...(current.locationOcclusionMasks ?? {}),
  };
  if (mask?.points.length) locationOcclusionMasks[locationId] = mask;
  else delete locationOcclusionMasks[locationId];
  return {
    ...current,
    version: 4,
    locationOcclusionMasks,
  };
}

export function updateLocationMask(
  editorData: any,
  locationId: string,
  mask?: ResourceMask,
): ExplorationEditorData {
  const current = (editorData ?? {}) as ExplorationEditorData;
  const locationMasks = { ...(current.locationMasks ?? {}) };
  if (mask?.points.length) locationMasks[locationId] = mask;
  else delete locationMasks[locationId];
  return {
    ...current,
    version: 4,
    locationMasks,
  };
}

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
    version: Math.max(Number(current.version) || 0, 4),
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
    version: 4,
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
    version: 4,
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
    version: 4,
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
