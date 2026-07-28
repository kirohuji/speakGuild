import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ArrowLeft,
  BookOpen,
  Box,
  ChevronDown,
  ChevronUp,
  DoorOpen,
  Edit3,
  Eraser,
  Eye,
  Headphones,
  Languages,
  Layers3,
  LockKeyhole,
  Map,
  MapPin,
  MessageCircle,
  Moon,
  Plus,
  Route,
  RotateCcw,
  Group,
  Monitor,
  Smartphone,
  Sparkles,
  Sun,
  Sunrise,
  Trash2,
  Undo2,
  Ungroup,
  Volume2,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectItem } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/cn";
import { post } from "@/lib/request";
import {
  createLocation,
  createMap,
  createRoom,
  deleteLocation,
  deleteRoom,
  listLocations,
  listMaps,
  listRooms,
  updateLocation,
  updateMap,
  updateRoom,
  type GameLocationData,
  type GameMapData,
  type GameRoomData,
} from "../api-content-admin";
import { ImageUploadField } from "./image-upload-field";
import {
  ExplorationPixiCanvas,
  type ExplorationNode,
} from "./maps/exploration-pixi-canvas";
import {
  BACKGROUND_LAYER_ID,
  DEFAULT_CONTENT_LAYER_ID,
  DEFAULT_LOCATION_VISUAL_STYLE,
  getExplorationObjects,
  getExplorationLayers,
  getExplorationNodeGroupId,
  getExplorationNodeLayerId,
  getLocationMask,
  getLocationOcclusionMask,
  getLocationVisualStyle,
  getRoomLayout,
  getSceneDimensions,
  makeExplorationKey,
  removeExplorationObject,
  updateExplorationObjectPosition,
  updateExplorationLayers,
  updateExplorationNodeGroups,
  updateExplorationNodeLayers,
  updateRoomLayout,
  updateSceneDimensions,
  updateLocationMask,
  updateLocationOcclusionMask,
  updateLocationVisualStyle,
  upsertExplorationObject,
  type ResourceMaskPoint,
  type LocationVisualStyle,
  type ExplorationObject,
  type ExplorationObjectKind,
  type ExplorationLayer,
} from "./maps/exploration-map-model";

type StudioLevel = "world" | "location" | "room";
type TimeOfDay = "day" | "golden" | "night";
type ObjectFilter = "all" | "required" | "undiscovered";
type MaskTool = "erase" | "restore";
type MaskLayer = "transparency" | "occlusion";
type PreviewOrientation = "portrait" | "landscape";

const EMPTY_OBJECT: Omit<ExplorationObject, "id" | "roomId"> = {
  title: "",
  english: "",
  translation: "",
  pronunciation: "",
  example: "",
  prompt: "",
  imageUrl: "",
  kind: "vocabulary",
  x: 50,
  y: 55,
  width: 110,
  height: 110,
  required: false,
  hidden: false,
};

const OBJECT_KIND_LABELS: Record<ExplorationObjectKind, string> = {
  vocabulary: "词汇物品",
  reading: "阅读线索",
  listening: "听力物品",
  clue: "剧情线索",
  quest: "任务物品",
};

const LOCATION_RESOURCE_BASE_SIZE = 80;

export function NarrativeWorldStudio({
  onLocationsChange,
}: {
  onLocationsChange?: (locations: GameLocationData[]) => void;
}) {
  const [maps, setMaps] = useState<GameMapData[]>([]);
  const [locations, setLocations] = useState<GameLocationData[]>([]);
  const [rooms, setRooms] = useState<GameRoomData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mapId, setMapId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [objectId, setObjectId] = useState("");
  const [level, setLevel] = useState<StudioLevel>("world");
  const [editable, setEditable] = useState(true);
  const [previewOrientation, setPreviewOrientation] =
    useState<PreviewOrientation>("portrait");
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>("day");
  const [objectFilter, setObjectFilter] = useState<ObjectFilter>("all");
  const [focusNodeId, setFocusNodeId] = useState("");
  const [touring, setTouring] = useState(false);
  const [tourIndex, setTourIndex] = useState(0);
  const [discovered, setDiscovered] = useState<Set<string>>(new Set());
  const [previewId, setPreviewId] = useState("");
  const [maskEditing, setMaskEditing] = useState(false);
  const [maskTool, setMaskTool] = useState<MaskTool>("erase");
  const [maskLayer, setMaskLayer] = useState<MaskLayer>("transparency");
  const [maskBrushSize, setMaskBrushSize] = useState(8);
  const [showMaskOverlay, setShowMaskOverlay] = useState(false);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [activeLayerId, setActiveLayerId] = useState(DEFAULT_CONTENT_LAYER_ID);
  const maskDraftRef = useRef<any>(null);

  const [mapDialog, setMapDialog] = useState(false);
  const [locationDialog, setLocationDialog] = useState(false);
  const [roomDialog, setRoomDialog] = useState(false);
  const [objectDialog, setObjectDialog] = useState(false);
  const [editingMap, setEditingMap] = useState<GameMapData | null>(null);
  const [editingLocation, setEditingLocation] =
    useState<GameLocationData | null>(null);
  const [editingRoom, setEditingRoom] = useState<GameRoomData | null>(null);
  const [editingObject, setEditingObject] =
    useState<ExplorationObject | null>(null);

  const [mapForm, setMapForm] = useState({
    displayName: "",
    backgroundUrl: "",
    thumbnailUrl: "",
    width: 1920,
    height: 1080,
  });
  const [locationForm, setLocationForm] = useState({
    displayName: "",
    description: "",
    icon: "",
    backgroundUrl: "",
    locationType: "building",
  });
  const [roomForm, setRoomForm] = useState({
    displayName: "",
    description: "",
    icon: "",
    backgroundUrl: "",
    roomType: "exploration",
    inkScriptId: "",
    isEntrance: false,
  });
  const [objectForm, setObjectForm] = useState(EMPTY_OBJECT);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextMaps, nextLocations, nextRooms] = await Promise.all([
        listMaps(),
        listLocations(),
        listRooms(),
      ]);
      setMaps(nextMaps);
      setLocations(nextLocations);
      setRooms(nextRooms);
      onLocationsChange?.(nextLocations);
      setMapId((current) =>
        nextMaps.some((item) => item.id === current)
          ? current
          : (nextMaps[0]?.id ?? ""),
      );
    } catch {
      toast.error("地图世界加载失败");
    } finally {
      setLoading(false);
    }
  }, [onLocationsChange]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedMap = maps.find((item) => item.id === mapId) ?? null;
  const mapLocations = useMemo(
    () => locations.filter((item) => item.mapId === mapId),
    [locations, mapId],
  );
  const selectedLocation =
    mapLocations.find((item) => item.id === locationId) ?? null;
  const locationRooms = useMemo(
    () => rooms.filter((item) => item.locationId === locationId),
    [locationId, rooms],
  );
  const selectedRoom =
    locationRooms.find((item) => item.id === roomId) ?? null;
  const roomObjects = getExplorationObjects(selectedMap, roomId);
  const selectedObject =
    roomObjects.find((item) => item.id === objectId) ?? null;

  const visibleObjects = roomObjects.filter((item) => {
    if (objectFilter === "required") return item.required;
    if (objectFilter === "undiscovered") return !discovered.has(item.id);
    return true;
  });

  const layerScope =
    level === "world"
      ? "world"
      : level === "location"
        ? `location:${locationId}`
        : `room:${roomId}`;
  const layers = useMemo(
    () => getExplorationLayers(selectedMap?.editorData, layerScope),
    [layerScope, selectedMap?.editorData],
  );

  useEffect(() => {
    setSelectedNodeIds([]);
    setActiveLayerId(DEFAULT_CONTENT_LAYER_ID);
  }, [layerScope]);

  const nodes = useMemo<ExplorationNode[]>(() => {
    const withLayer = <T extends ExplorationNode>(node: T): T => {
      const layerId = getExplorationNodeLayerId(selectedMap?.editorData, node.id);
      return {
        ...node,
        layerId,
        layerOrder:
          layers.find((layer) => layer.id === layerId)?.order ?? 1,
        groupId: getExplorationNodeGroupId(selectedMap?.editorData, node.id),
      };
    };
    if (level === "world") {
      return mapLocations.map((location) => withLayer({
        id: location.id,
        title: location.displayName,
        subtitle: `${rooms.filter((room) => room.locationId === location.id).length} 个房间`,
        imageUrl: location.icon,
        x: location.posX || 50,
        y: location.posY || 50,
        width: Math.max(80, location.iconWidth ?? 150),
        height: Math.max(80, location.iconHeight ?? 120),
        mask: getLocationMask(selectedMap, location.id),
        occlusionMask: getLocationOcclusionMask(selectedMap, location.id),
        visualStyle: getLocationVisualStyle(selectedMap, location.id),
        kind: "location",
        disabled: location.disabled,
        hidden: location.hidden,
      }));
    }
    if (level === "location") {
      return locationRooms.map((room, index) => withLayer({
        id: room.id,
        title: room.displayName,
        subtitle: room.isEntrance ? "入口房间" : room.roomType,
        imageUrl: room.icon,
        ...getRoomLayout(selectedMap, locationId, room.id, index),
        kind: "room",
        disabled: room.disabled,
        hidden: room.hidden,
      }));
    }
    return visibleObjects.map((item) => withLayer({
      id: item.id,
      title: item.english || item.title,
      subtitle: item.translation || OBJECT_KIND_LABELS[item.kind],
      imageUrl: item.imageUrl,
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.height,
      kind: "object",
      required: item.required,
      hidden: item.hidden,
    }));
  }, [
    layers,
    level,
    locationId,
    locationRooms,
    mapLocations,
    rooms,
    selectedMap,
    visibleObjects,
  ]);

  const backgroundUrl =
    level === "world"
      ? selectedMap?.backgroundUrl
      : level === "location"
        ? selectedLocation?.backgroundUrl
        : selectedRoom?.backgroundUrl;
  const sceneDimensions =
    level === "world"
      ? {
          width: selectedMap?.width ?? 1920,
          height: selectedMap?.height ?? 1080,
        }
      : getSceneDimensions(selectedMap?.editorData, layerScope);
  const worldWidth = sceneDimensions.width;
  const worldHeight = sceneDimensions.height;
  const selectedNodeId =
    level === "world" ? locationId : level === "location" ? roomId : objectId;
  const effectiveSelectedNodeIds = selectedNodeIds.length
    ? selectedNodeIds
    : selectedNodeId
      ? [selectedNodeId]
      : [];
  const nodeBreathing = Boolean(
    selectedMap?.editorData?.preview?.nodeBreathing,
  );

  const persistEditorData = async (editorData: unknown) => {
    if (!selectedMap) return;
    setMaps((items) =>
      items.map((item) =>
        item.id === selectedMap.id ? { ...item, editorData } : item,
      ),
    );
    try {
      await updateMap(selectedMap.id, { editorData });
    } catch {
      toast.error("探索布局保存失败");
      await load();
    }
  };

  const enterLocation = (id: string) => {
    setLocationId(id);
    setRoomId("");
    setObjectId("");
    setLevel("location");
    setFocusNodeId("");
  };

  const enterRoom = (id: string) => {
    setRoomId(id);
    setObjectId("");
    setLevel("room");
    setFocusNodeId("");
  };

  const goBack = () => {
    if (level === "room") {
      setLevel("location");
      setObjectId("");
    } else {
      setLevel("world");
      setRoomId("");
      setLocationId("");
    }
    setPreviewId("");
    setFocusNodeId("");
  };

  const selectNode = (id: string, additive = false) => {
    const node = nodes.find((item) => item.id === id);
    const relatedIds = node?.groupId
      ? nodes
          .filter((item) => item.groupId === node.groupId)
          .map((item) => item.id)
      : [id];
    setSelectedNodeIds((current) => {
      if (!editable || !additive) return relatedIds;
      const allSelected = relatedIds.every((item) => current.includes(item));
      return allSelected
        ? current.filter((item) => !relatedIds.includes(item))
        : [...new Set([...current, ...relatedIds])];
    });
    if (level === "world") setLocationId(id);
    else if (level === "location") setRoomId(id);
    else setObjectId(id);
    if (!editable) setFocusNodeId(id);
  };

  const openNode = (id: string) => {
    if (editable) return;
    setPreviewId(id);
    setFocusNodeId(id);
  };

  const moveNode = async (id: string, x: number, y: number) => {
    const activeNode = nodes.find((item) => item.id === id);
    if (!activeNode) return;
    const movedNodes = activeNode.groupId
      ? nodes.filter((item) => item.groupId === activeNode.groupId)
      : [activeNode];
    const deltaX = x - activeNode.x;
    const deltaY = y - activeNode.y;
    const positions = new globalThis.Map(
      movedNodes.map((node) => [
        node.id,
        {
          x: Math.max(0, Math.min(100, node.x + deltaX)),
          y: Math.max(0, Math.min(100, node.y + deltaY)),
        },
      ]),
    );
    if (level === "world") {
      setLocations((items) =>
        items.map((item) => {
          const position = positions.get(item.id);
          return position
            ? { ...item, posX: position.x, posY: position.y }
            : item;
        }),
      );
      try {
        await Promise.all(
          [...positions].map(([nodeId, position]) =>
            updateLocation(nodeId, {
              posX: position.x,
              posY: position.y,
            }),
          ),
        );
      } catch {
        toast.error("地点位置保存失败");
        await load();
      }
      return;
    }
    if (!selectedMap) return;
    if (level === "location") {
      let nextEditorData = selectedMap.editorData;
      for (const [nodeId, position] of positions) {
        const index = locationRooms.findIndex((item) => item.id === nodeId);
        const current = getRoomLayout(
          { ...selectedMap, editorData: nextEditorData },
          locationId,
          nodeId,
          Math.max(index, 0),
        );
        nextEditorData = updateRoomLayout(
          nextEditorData,
          locationId,
          nodeId,
          {
          ...current,
            ...position,
          },
        );
      }
      await persistEditorData(nextEditorData);
      return;
    }
    let nextEditorData = selectedMap.editorData;
    for (const [nodeId, position] of positions) {
      nextEditorData = updateExplorationObjectPosition(
        nextEditorData,
        roomId,
        nodeId,
        position.x,
        position.y,
      );
    }
    await persistEditorData(nextEditorData);
  };

  const getLocationSize = (location: GameLocationData, scale: number) => {
    const currentWidth = Math.max(
      LOCATION_RESOURCE_BASE_SIZE,
      location.iconWidth ?? LOCATION_RESOURCE_BASE_SIZE,
    );
    const currentHeight = Math.max(
      LOCATION_RESOURCE_BASE_SIZE,
      location.iconHeight ?? LOCATION_RESOURCE_BASE_SIZE,
    );
    const ratio = currentWidth / Math.max(currentHeight, 1);
    const longestSide = LOCATION_RESOURCE_BASE_SIZE * scale;
    return {
      iconWidth: Math.round(
        ratio >= 1 ? longestSide : Math.max(1, longestSide * ratio),
      ),
      iconHeight: Math.round(
        ratio >= 1 ? Math.max(1, longestSide / ratio) : longestSide,
      ),
    };
  };

  const resizeSelectedLocation = (scale: number) => {
    if (!selectedLocation) return;
    const size = getLocationSize(selectedLocation, scale);
    setLocations((items) =>
      items.map((item) =>
        item.id === selectedLocation.id ? { ...item, ...size } : item,
      ),
    );
  };

  const saveSelectedLocationSize = async (scale: number) => {
    if (!selectedLocation) return;
    const size = getLocationSize(selectedLocation, scale);
    try {
      await updateLocation(selectedLocation.id, size);
      toast.success("地点素材大小已保存");
    } catch {
      toast.error("地点素材大小保存失败");
      await load();
    }
  };

  const updateSelectedLocationVisual = (style: LocationVisualStyle) => {
    if (!selectedMap || !selectedLocation) return;
    const next = updateLocationVisualStyle(
      selectedMap.editorData,
      selectedLocation.id,
      style,
    );
    setMaps((items) =>
      items.map((item) =>
        item.id === selectedMap.id ? { ...item, editorData: next } : item,
      ),
    );
  };

  const saveSelectedLocationVisual = async (style: LocationVisualStyle) => {
    if (!selectedMap || !selectedLocation) return;
    const next = updateLocationVisualStyle(
      selectedMap.editorData,
      selectedLocation.id,
      style,
    );
    try {
      await updateMap(selectedMap.id, { editorData: next });
    } catch {
      toast.error("地点调色保存失败");
      await load();
    }
  };

  const autoMatchSelectedLocation = async () => {
    if (!selectedMap?.backgroundUrl || !selectedLocation?.icon) {
      toast.error("需要先设置地图底图和地点图片");
      return;
    }
    try {
      const result = await post<{ style: LocationVisualStyle }>(
        "/file-assets/sampling/match",
        {
          backgroundUrl: selectedMap.backgroundUrl,
          resourceUrl: selectedLocation.icon,
          positionX: selectedLocation.posX / 100,
          positionY: selectedLocation.posY / 100,
        },
      );
      const style = result.style;
      updateSelectedLocationVisual(style);
      await saveSelectedLocationVisual(style);
      toast.success(
        [
          "自动匹配完成",
          `亮度 ${Math.round(style.brightness * 100)}%`,
          `对比度 ${Math.round(style.contrast * 100)}%`,
          `饱和度 ${Math.round(style.saturation * 100)}%`,
          `色相 ${Math.round(style.hue)}°`,
          `${style.warmth < 0 ? "冷" : "暖"} ${Math.round(Math.abs(style.warmth) * 100)}`,
          `阴影 ${Math.round(style.shadowOpacity * 100)}%`,
        ].join(" · "),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "未知采样错误";
      console.error("[narrative-map] 自动匹配失败", error);
      toast.error(`自动匹配失败：${message}`);
    }
  };

  const saveSceneBackground = async (url: string) => {
    try {
      if (level === "world" && selectedMap) {
        setMaps((items) =>
          items.map((item) =>
            item.id === selectedMap.id
              ? { ...item, backgroundUrl: url }
              : item,
          ),
        );
        await updateMap(selectedMap.id, { backgroundUrl: url });
      } else if (level === "location" && selectedLocation) {
        setLocations((items) =>
          items.map((item) =>
            item.id === selectedLocation.id
              ? { ...item, backgroundUrl: url }
              : item,
          ),
        );
        await updateLocation(selectedLocation.id, { backgroundUrl: url });
      } else if (level === "room" && selectedRoom) {
        setRooms((items) =>
          items.map((item) =>
            item.id === selectedRoom.id
              ? { ...item, backgroundUrl: url }
              : item,
          ),
        );
        await updateRoom(selectedRoom.id, { backgroundUrl: url });
      } else {
        return;
      }
      toast.success(url ? "当前场景底图已更新" : "当前场景底图已移除");
    } catch {
      toast.error("场景底图保存失败");
      await load();
    }
  };

  const updateSceneDimensionDraft = (
    field: "width" | "height",
    value: number,
  ) => {
    // Allow free typing without aggressive clamping — only enforce safety bounds.
    // Business validation (min 320) is applied on blur in saveSceneDimensions.
    const safeValue = Number.isFinite(value) ? value : sceneDimensions[field];
    const next = {
      ...sceneDimensions,
      [field]: Math.max(1, Math.min(8192, safeValue)),
    };
    if (level === "world" && selectedMap) {
      setMaps((items) =>
        items.map((item) =>
          item.id === selectedMap.id ? { ...item, ...next } : item,
        ),
      );
      return;
    }
    if (!selectedMap) return;
    setMaps((items) =>
      items.map((item) =>
        item.id === selectedMap.id
          ? {
              ...item,
              editorData: updateSceneDimensions(
                item.editorData,
                layerScope,
                next,
              ),
            }
          : item,
      ),
    );
  };

  const saveSceneDimensions = async () => {
    if (!selectedMap) return;
    // Apply business validation on save: clamp to 320–8192 and round to integer.
    const clamped = {
      width: Math.max(320, Math.min(8192, Math.round(sceneDimensions.width))),
      height: Math.max(320, Math.min(8192, Math.round(sceneDimensions.height))),
    };
    // Push clamped value back to local state so the input reflects the validated number.
    if (level === "world") {
      setMaps((items) =>
        items.map((item) =>
          item.id === selectedMap.id ? { ...item, ...clamped } : item,
        ),
      );
    } else {
      setMaps((items) =>
        items.map((item) =>
          item.id === selectedMap.id
            ? {
                ...item,
                editorData: updateSceneDimensions(
                  item.editorData,
                  layerScope,
                  clamped,
                ),
              }
            : item,
        ),
      );
    }
    try {
      if (level === "world") {
        await updateMap(selectedMap.id, clamped);
      } else {
        await persistEditorData(
          updateSceneDimensions(
            selectedMap.editorData,
            layerScope,
            clamped,
          ),
        );
      }
      toast.success("场景尺寸已保存");
    } catch {
      toast.error("场景尺寸保存失败");
      await load();
    }
  };

  const updateNodeBreathing = async (enabled: boolean) => {
    if (!selectedMap) return;
    await persistEditorData({
      ...(selectedMap.editorData ?? {}),
      version: 4,
      preview: {
        ...(selectedMap.editorData?.preview ?? {}),
        nodeBreathing: enabled,
      },
    });
  };

  const addLayer = async () => {
    if (!selectedMap) return;
    const layer: ExplorationLayer = {
      id: `layer_${Date.now().toString(36)}`,
      name: `图层 ${layers.length}`,
      order: layers.length,
    };
    const nextLayers = [...layers, layer];
    setActiveLayerId(layer.id);
    await persistEditorData(
      updateExplorationLayers(selectedMap.editorData, layerScope, nextLayers),
    );
  };

  const deleteActiveLayer = async () => {
    if (
      !selectedMap ||
      activeLayerId === BACKGROUND_LAYER_ID ||
      activeLayerId === DEFAULT_CONTENT_LAYER_ID
    ) {
      return;
    }
    const nodeIds = nodes
      .filter((node) => node.layerId === activeLayerId)
      .map((node) => node.id);
    let nextEditorData = updateExplorationLayers(
      selectedMap.editorData,
      layerScope,
      layers.filter((layer) => layer.id !== activeLayerId),
    );
    if (nodeIds.length) {
      nextEditorData = updateExplorationNodeLayers(
        nextEditorData,
        nodeIds,
        DEFAULT_CONTENT_LAYER_ID,
      );
    }
    setActiveLayerId(DEFAULT_CONTENT_LAYER_ID);
    await persistEditorData(nextEditorData);
    toast.success("图层已删除，原有元素已移至元素层");
  };

  const reorderActiveLayer = async (direction: "up" | "down") => {
    if (
      !selectedMap ||
      activeLayerId === BACKGROUND_LAYER_ID ||
      activeLayerId === DEFAULT_CONTENT_LAYER_ID
    ) {
      return;
    }
    const contentLayers = layers.filter(
      (layer) => layer.id !== BACKGROUND_LAYER_ID,
    );
    const index = contentLayers.findIndex(
      (layer) => layer.id === activeLayerId,
    );
    const target =
      direction === "up"
        ? Math.min(contentLayers.length - 1, index + 1)
        : Math.max(1, index - 1);
    if (index < 0 || target === index) return;
    const reordered = [...contentLayers];
    [reordered[index], reordered[target]] = [
      reordered[target],
      reordered[index],
    ];
    await persistEditorData(
      updateExplorationLayers(selectedMap.editorData, layerScope, [
        layers[0],
        ...reordered,
      ]),
    );
  };

  const moveSelectionToActiveLayer = async () => {
    if (
      !selectedMap ||
      !effectiveSelectedNodeIds.length ||
      activeLayerId === BACKGROUND_LAYER_ID
    ) {
      return;
    }
    await persistEditorData(
      updateExplorationNodeLayers(
        selectedMap.editorData,
        effectiveSelectedNodeIds,
        activeLayerId,
      ),
    );
    toast.success(`已移入${layers.find((layer) => layer.id === activeLayerId)?.name}`);
  };

  const groupSelection = async () => {
    if (!selectedMap || effectiveSelectedNodeIds.length < 2) return;
    const groupId = `group_${Date.now().toString(36)}`;
    const layerId =
      activeLayerId === BACKGROUND_LAYER_ID
        ? DEFAULT_CONTENT_LAYER_ID
        : activeLayerId;
    let nextEditorData = updateExplorationNodeLayers(
      selectedMap.editorData,
      effectiveSelectedNodeIds,
      layerId,
    );
    nextEditorData = updateExplorationNodeGroups(
      nextEditorData,
      Object.fromEntries(
        effectiveSelectedNodeIds.map((nodeId) => [nodeId, groupId]),
      ),
    );
    await persistEditorData(nextEditorData);
    toast.success(`已组合 ${effectiveSelectedNodeIds.length} 个元素`);
  };

  const ungroupSelection = async () => {
    if (!selectedMap || !effectiveSelectedNodeIds.length) return;
    const selectedGroupIds = new Set(
      effectiveSelectedNodeIds
        .map((nodeId) =>
          getExplorationNodeGroupId(selectedMap.editorData, nodeId),
        )
        .filter((groupId): groupId is string => !!groupId),
    );
    if (!selectedGroupIds.size) return;
    const assignments = Object.fromEntries(
      nodes
        .filter((node) => node.groupId && selectedGroupIds.has(node.groupId))
        .map((node) => [node.id, undefined]),
    );
    await persistEditorData(
      updateExplorationNodeGroups(selectedMap.editorData, assignments),
    );
    toast.success("已取消组合");
  };

  const resetSelectedLocationVisual = async () => {
    const style = { ...DEFAULT_LOCATION_VISUAL_STYLE };
    updateSelectedLocationVisual(style);
    await saveSelectedLocationVisual(style);
    toast.success("已恢复图片原始色彩");
  };

  const appendLocationMaskPoint = (
    locationId: string,
    point: ResourceMaskPoint,
  ) => {
    if (!selectedMap) return;
    const current = maskDraftRef.current ?? selectedMap.editorData;
    const existing =
      (maskLayer === "occlusion"
        ? current?.locationOcclusionMasks?.[locationId]?.points
        : current?.locationMasks?.[locationId]?.points) ?? [];
    const points =
      maskTool === "restore"
        ? existing.filter((item: ResourceMaskPoint) => {
            const distance = Math.hypot(item.x - point.x, item.y - point.y);
            return distance > item.radius + point.radius;
          })
        : [...existing, point];
    const next =
      maskLayer === "occlusion"
        ? updateLocationOcclusionMask(current, locationId, { points })
        : updateLocationMask(current, locationId, { points });
    maskDraftRef.current = next;
    setMaps((items) =>
      items.map((item) =>
        item.id === selectedMap.id ? { ...item, editorData: next } : item,
      ),
    );
  };

  const saveLocationMask = async () => {
    if (!selectedMap || !maskDraftRef.current) return;
    try {
      await updateMap(selectedMap.id, { editorData: maskDraftRef.current });
    } catch {
      toast.error("蒙版保存失败");
      maskDraftRef.current = null;
      await load();
    }
  };

  const replaceSelectedLocationMask = async (
    points: ResourceMaskPoint[],
  ) => {
    if (!selectedMap || !selectedLocation) return;
    const next =
      maskLayer === "occlusion"
        ? updateLocationOcclusionMask(
            selectedMap.editorData,
            selectedLocation.id,
            { points },
          )
        : updateLocationMask(selectedMap.editorData, selectedLocation.id, {
            points,
          });
    maskDraftRef.current = next;
    setMaps((items) =>
      items.map((item) =>
        item.id === selectedMap.id ? { ...item, editorData: next } : item,
      ),
    );
    await saveLocationMask();
  };

  useEffect(() => {
    if (!touring || !nodes.length) return;
    setFocusNodeId(nodes[0].id);
    const timer = window.setInterval(() => {
      setTourIndex((index) => {
        const next = (index + 1) % nodes.length;
        setFocusNodeId(nodes[next].id);
        return next;
      });
    }, 2200);
    return () => window.clearInterval(timer);
  }, [nodes, touring]);

  const startTour = () => {
    if (!nodes.length) return;
    setEditable(false);
    setTourIndex(0);
    setTouring(true);
    setFocusNodeId(nodes[0].id);
  };

  const openMapForm = (map?: GameMapData) => {
    setEditingMap(map ?? null);
    setMapForm({
      displayName: map?.displayName ?? "",
      backgroundUrl: map?.backgroundUrl ?? "",
      thumbnailUrl: map?.thumbnailUrl ?? "",
      width: map?.width ?? 1920,
      height: map?.height ?? 1080,
    });
    setMapDialog(true);
  };

  const saveMap = async () => {
    if (!mapForm.displayName.trim()) return;
    setSaving(true);
    try {
      if (editingMap) await updateMap(editingMap.id, mapForm);
      else
        await createMap({
          ...mapForm,
          name: makeExplorationKey(mapForm.displayName, "map"),
          requiredOutputLevel: "L1",
          editorData: { version: 4, explorationObjects: {} },
          sortOrder: maps.length,
        });
      setMapDialog(false);
      await load();
      toast.success("地图已保存");
    } catch {
      toast.error("地图保存失败");
    } finally {
      setSaving(false);
    }
  };

  const openLocationForm = (location?: GameLocationData) => {
    setEditingLocation(location ?? null);
    setLocationForm({
      displayName: location?.displayName ?? "",
      description: location?.description ?? "",
      icon: location?.icon ?? "",
      backgroundUrl: location?.backgroundUrl ?? "",
      locationType: location?.locationType ?? "building",
    });
    setLocationDialog(true);
  };

  const saveLocation = async () => {
    if (!selectedMap || !locationForm.displayName.trim()) return;
    setSaving(true);
    try {
      if (editingLocation)
        await updateLocation(editingLocation.id, locationForm);
      else
        await createLocation({
          ...locationForm,
          mapId: selectedMap.id,
          name: makeExplorationKey(locationForm.displayName, "location"),
          posX: 50,
          posY: 55,
          iconWidth: 160,
          iconHeight: 130,
          requiredOutputLevel: "L1",
          sortOrder: mapLocations.length,
        });
      setLocationDialog(false);
      await load();
      toast.success("地点已保存");
    } catch {
      toast.error("地点保存失败");
    } finally {
      setSaving(false);
    }
  };

  const openRoomForm = (room?: GameRoomData) => {
    setEditingRoom(room ?? null);
    setRoomForm({
      displayName: room?.displayName ?? "",
      description: room?.description ?? "",
      icon: room?.icon ?? "",
      backgroundUrl: room?.backgroundUrl ?? "",
      roomType: room?.roomType ?? "exploration",
      inkScriptId: room?.inkScriptId ?? "",
      isEntrance: room?.isEntrance ?? locationRooms.length === 0,
    });
    setRoomDialog(true);
  };

  const saveRoom = async () => {
    if (!selectedLocation || !roomForm.displayName.trim()) return;
    setSaving(true);
    try {
      if (editingRoom) await updateRoom(editingRoom.id, roomForm);
      else
        await createRoom({
          ...roomForm,
          locationId: selectedLocation.id,
          name: makeExplorationKey(roomForm.displayName, "room"),
          requiredOutputLevel: "L1",
          sortOrder: locationRooms.length,
        });
      setRoomDialog(false);
      await load();
      toast.success("房间已保存");
    } catch {
      toast.error("房间保存失败");
    } finally {
      setSaving(false);
    }
  };

  const openObjectForm = (object?: ExplorationObject) => {
    setEditingObject(object ?? null);
    setObjectForm(
      object
        ? {
            title: object.title,
            english: object.english,
            translation: object.translation,
            pronunciation: object.pronunciation ?? "",
            example: object.example ?? "",
            prompt: object.prompt ?? "",
            imageUrl: object.imageUrl ?? "",
            kind: object.kind,
            x: object.x,
            y: object.y,
            width: object.width,
            height: object.height,
            required: object.required,
            hidden: object.hidden,
          }
        : { ...EMPTY_OBJECT },
    );
    setObjectDialog(true);
  };

  const saveObject = async () => {
    if (!selectedMap || !selectedRoom || !objectForm.title.trim()) return;
    const object: ExplorationObject = {
      ...objectForm,
      id:
        editingObject?.id ??
        `${makeExplorationKey(objectForm.english || objectForm.title, "object")}_${Date.now().toString(36)}`,
      roomId: selectedRoom.id,
    };
    setSaving(true);
    try {
      await persistEditorData(
        upsertExplorationObject(
          selectedMap.editorData,
          selectedRoom.id,
          object,
        ),
      );
      setObjectId(object.id);
      setObjectDialog(false);
      toast.success("探索物品已保存");
    } finally {
      setSaving(false);
    }
  };

  const deleteCurrent = async () => {
    if (level === "world" && selectedLocation) {
      if (!window.confirm(`删除地点“${selectedLocation.displayName}”及其房间？`))
        return;
      await deleteLocation(selectedLocation.id);
      setLocationId("");
      await load();
    } else if (level === "location" && selectedRoom) {
      if (!window.confirm(`删除房间“${selectedRoom.displayName}”？`)) return;
      await deleteRoom(selectedRoom.id);
      setRoomId("");
      await load();
    } else if (level === "room" && selectedObject && selectedMap) {
      await persistEditorData(
        removeExplorationObject(
          selectedMap.editorData,
          roomId,
          selectedObject.id,
        ),
      );
      setObjectId("");
      toast.success("探索物品已删除");
    }
  };

  const previewLocation =
    level === "world"
      ? mapLocations.find((item) => item.id === previewId)
      : null;
  const previewRoom =
    level === "location"
      ? locationRooms.find((item) => item.id === previewId)
      : null;
  const previewObject =
    level === "room"
      ? roomObjects.find((item) => item.id === previewId)
      : null;

  const pronounce = (text: string) => {
    if (!text || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.86;
    window.speechSynthesis.speak(utterance);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-20 text-center text-sm text-muted-foreground">
          正在装载地图世界与探索资源…
        </CardContent>
      </Card>
    );
  }

  if (!maps.length) {
    return (
      <Card className="border-dashed">
        <CardHeader className="items-center text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Map />
          </div>
          <CardTitle>创建第一个剧情世界</CardTitle>
          <CardDescription>
            上传世界底图，然后逐层放置地点、房间和可学习物品。
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center pb-8">
          <Button onClick={() => openMapForm()}>
            <Plus data-icon="inline-start" />
            新建地图世界
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="overflow-hidden">
        <CardContent className="flex flex-wrap items-center gap-3 p-3">
          <Select
            value={mapId}
            onChange={(event) => {
              setMapId(event.target.value);
              setLevel("world");
              setLocationId("");
              setRoomId("");
              setObjectId("");
            }}
            className="w-[220px]"
          >
            {maps.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.displayName}
              </SelectItem>
            ))}
          </Select>
          {editable && (
            <>
              <Button size="sm" variant="outline" onClick={() => openMapForm()}>
                <Plus data-icon="inline-start" />
                新建世界
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => selectedMap && openMapForm(selectedMap)}
              >
                <Edit3 data-icon="inline-start" />
                世界属性
              </Button>
            </>
          )}
          <Separator orientation="vertical" className="h-7" />
          {level !== "world" && (
            <Button size="sm" variant="ghost" onClick={goBack}>
              <ArrowLeft data-icon="inline-start" />
              返回上一级
            </Button>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              {selectedMap?.displayName}
              {selectedLocation ? ` / ${selectedLocation.displayName}` : ""}
              {selectedRoom ? ` / ${selectedRoom.displayName}` : ""}
            </p>
            <p className="text-xs text-muted-foreground">
              {level === "world"
                ? "世界地图：放置剧情地点"
                : level === "location"
                  ? "地点场景：放置可进入房间"
                  : "房间探索：放置英语物品、线索和任务"}
            </p>
          </div>
          {!editable && (
            <ToggleGroup
              type="single"
              value={previewOrientation}
              onValueChange={(value) =>
                value &&
                setPreviewOrientation(value as PreviewOrientation)
              }
              aria-label="预览屏幕方向"
            >
              <ToggleGroupItem value="portrait" aria-label="竖屏预览">
                <Smartphone />
              </ToggleGroupItem>
              <ToggleGroupItem value="landscape" aria-label="横屏预览">
                <Monitor />
              </ToggleGroupItem>
            </ToggleGroup>
          )}
          {!editable && (
            <ToggleGroup
              type="single"
              value={timeOfDay}
              onValueChange={(value) => value && setTimeOfDay(value as TimeOfDay)}
              aria-label="预览光线"
            >
              <ToggleGroupItem value="day" aria-label="日间">
                <Sun />
              </ToggleGroupItem>
              <ToggleGroupItem value="golden" aria-label="黄昏">
                <Sunrise />
              </ToggleGroupItem>
              <ToggleGroupItem value="night" aria-label="夜间">
                <Moon />
              </ToggleGroupItem>
            </ToggleGroup>
          )}
          {editable && selectedMap && (
            <div className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5">
              <Label htmlFor="preview-node-breathing" className="text-xs">
                预览呼吸
              </Label>
              <Switch
                id="preview-node-breathing"
                checked={nodeBreathing}
                onCheckedChange={(checked) =>
                  void updateNodeBreathing(checked)
                }
                aria-label="玩家预览自动呼吸缩放"
              />
            </div>
          )}
          <Tabs
            value={editable ? "edit" : "preview"}
            onValueChange={(value) => {
              setEditable(value === "edit");
              setTouring(false);
              setPreviewId("");
              setFocusNodeId("");
            }}
          >
            <TabsList className="h-9">
              <TabsTrigger value="edit" className="h-7 gap-1.5 px-3">
                <Wrench className="size-3.5" />
                编辑模式
              </TabsTrigger>
              <TabsTrigger value="preview" className="h-7 gap-1.5 px-3">
                <Eye className="size-3.5" />
                玩家预览
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button
            size="sm"
            variant="outline"
            disabled={!nodes.length}
            onClick={() => (touring ? setTouring(false) : startTour())}
          >
            <Route data-icon="inline-start" />
            {touring ? "停止导览" : "自动导览"}
          </Button>
          {editable && (
            <Button
              size="sm"
              onClick={() =>
                level === "world"
                  ? openLocationForm()
                  : level === "location"
                    ? openRoomForm()
                    : openObjectForm()
              }
            >
              <Plus data-icon="inline-start" />
              {level === "world"
                ? "添加地点"
                : level === "location"
                  ? "添加房间"
                  : "添加物品"}
            </Button>
          )}
        </CardContent>
      </Card>

      {level === "room" && (
        <div className="flex flex-wrap items-center gap-3">
          <ToggleGroup
            type="single"
            value={objectFilter}
            onValueChange={(value) =>
              value && setObjectFilter(value as ObjectFilter)
            }
            aria-label="物品筛选"
          >
            <ToggleGroupItem value="all">全部</ToggleGroupItem>
            <ToggleGroupItem value="required">任务物品</ToggleGroupItem>
            <ToggleGroupItem value="undiscovered">未发现</ToggleGroupItem>
          </ToggleGroup>
          <span className="text-xs text-muted-foreground">
            已发现 {roomObjects.filter((object) => discovered.has(object.id)).length}/
            {roomObjects.length}
          </span>
          <Progress
            value={
              roomObjects.length
                ? (roomObjects.filter((object) => discovered.has(object.id)).length /
                    roomObjects.length) *
                  100
                : 0
            }
            className="h-2 w-32"
          />
        </div>
      )}

      <div
        className={cn(
          "min-w-0 gap-4",
          editable
            ? "grid xl:grid-cols-[270px_minmax(0,1fr)_290px]"
            : "flex justify-center py-3",
        )}
      >
        {editable && (
          <div className="flex min-w-0 flex-col gap-4">
            <Card className="min-w-0">
              <CardHeader className="p-3 pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm">当前场景底图</CardTitle>
                  <Badge variant="outline">
                    <LockKeyhole data-icon="inline-start" />
                    底图层
                  </Badge>
                </div>
                <CardDescription>
                  {level === "world"
                    ? "世界地图场景"
                    : level === "location"
                      ? `${selectedLocation?.displayName ?? "地点"}场景`
                      : `${selectedRoom?.displayName ?? "房间"}探索场景`}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 p-3 pt-0">
                <div className="flex items-center gap-3">
                  <ImageUploadField
                    value={backgroundUrl ?? ""}
                    onChange={(url) => void saveSceneBackground(url)}
                    previewSize="md"
                    overlayUpload
                    allowVideo
                    disabled={
                      !selectedMap ||
                      (level === "location" && !selectedLocation) ||
                      (level === "room" && !selectedRoom)
                    }
                    placeholder="上传场景底图"
                  />
                  <p className="text-[11px] leading-5 text-muted-foreground">
                    支持图片或视频。底图决定场景边界、小地图和玩家相机范围。
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="场景宽度">
                    <Input
                      type="number"
                      min={320}
                      max={8192}
                      value={sceneDimensions.width}
                      onChange={(event) =>
                        updateSceneDimensionDraft(
                          "width",
                          Number(event.target.value),
                        )
                      }
                      onBlur={() => void saveSceneDimensions()}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") event.currentTarget.blur();
                      }}
                    />
                  </Field>
                  <Field label="场景高度">
                    <Input
                      type="number"
                      min={320}
                      max={8192}
                      value={sceneDimensions.height}
                      onChange={(event) =>
                        updateSceneDimensionDraft(
                          "height",
                          Number(event.target.value),
                        )
                      }
                      onBlur={() => void saveSceneDimensions()}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") event.currentTarget.blur();
                      }}
                    />
                  </Field>
                </div>
              </CardContent>
            </Card>
            <Card className="min-w-0">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">
                  {level === "world"
                    ? "地点资源"
                    : level === "location"
                      ? "房间资源"
                      : "探索物品"}
                </CardTitle>
                <CardDescription>
                  单击选择，预览模式下点击画布进入或发现。
                </CardDescription>
              </CardHeader>
              <CardContent className="p-2 pt-0">
                <ScrollArea className="h-[200px]">
                  <div className="flex flex-col gap-1 p-1">
                    {nodes.map((node) => (
                      <button
                        key={node.id}
                        type="button"
                        className={cn(
                          "flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                          effectiveSelectedNodeIds.includes(node.id)
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-muted",
                        )}
                        onClick={(event) =>
                          selectNode(
                            node.id,
                            event.shiftKey || event.ctrlKey || event.metaKey,
                          )
                        }
                        onDoubleClick={() => {
                          if (level === "world") enterLocation(node.id);
                          else if (level === "location") enterRoom(node.id);
                        }}
                      >
                        {level === "world" ? (
                          <MapPin className="shrink-0" />
                        ) : level === "location" ? (
                          <DoorOpen className="shrink-0" />
                        ) : (
                          <Box className="shrink-0" />
                        )}
                        <span className="min-w-0 flex-1 truncate">
                          {node.title}
                        </span>
                        {node.groupId && <Group className="shrink-0" />}
                        {node.required && <Sparkles className="shrink-0" />}
                      </button>
                    ))}
                    {!nodes.length && (
                      <p className="px-3 py-16 text-center text-xs text-muted-foreground">
                        当前层级还没有内容
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
            <LayerPanel
              layers={layers}
              nodes={nodes}
              hasBackground={!!backgroundUrl}
              activeLayerId={activeLayerId}
              selectedCount={effectiveSelectedNodeIds.length}
              onSelectLayer={setActiveLayerId}
              onAdd={() => void addLayer()}
              onDelete={() => void deleteActiveLayer()}
              onMoveUp={() => void reorderActiveLayer("up")}
              onMoveDown={() => void reorderActiveLayer("down")}
              onAssign={() => void moveSelectionToActiveLayer()}
              onGroup={() => void groupSelection()}
              onUngroup={() => void ungroupSelection()}
            />
          </div>
        )}

        <main
          className={cn(
            "min-w-0",
            !editable &&
              (previewOrientation === "landscape"
                ? "w-full max-w-[860px] rounded-[1.9rem] border-[7px] border-slate-950 bg-slate-950 p-1 shadow-2xl ring-1 ring-white/10"
                : "w-full max-w-[410px] rounded-[2.35rem] border-[8px] border-slate-950 bg-slate-950 p-1 shadow-2xl ring-1 ring-white/10"),
          )}
        >
          <ExplorationPixiCanvas
            backgroundUrl={backgroundUrl}
            nodes={nodes}
            selectedId={selectedNodeId}
            selectedIds={editable ? effectiveSelectedNodeIds : [selectedNodeId]}
            focusNodeId={focusNodeId}
            editable={editable}
            emptyLabel={
              level === "world"
                ? "请上传世界地图底图"
                : level === "location"
                  ? "请上传地点场景背景"
                  : "请上传房间场景背景"
            }
            worldWidth={worldWidth}
            worldHeight={worldHeight}
            timeOfDay={timeOfDay}
            nodeBreathing={nodeBreathing}
            mobilePreview={!editable}
            previewOrientation={previewOrientation}
            maskEditingId={
              editable && maskEditing && level === "world"
                ? selectedLocation?.id
                : undefined
            }
            maskBrushRadius={maskBrushSize / 100}
            maskRestoring={maskTool === "restore"}
            showMaskOverlay={showMaskOverlay}
            maskKind={maskLayer}
            onSelect={selectNode}
            onOpen={openNode}
            onMove={(id, x, y) => void moveNode(id, x, y)}
            onMaskPoint={appendLocationMaskPoint}
            onMaskEnd={() => void saveLocationMask()}
          />
        </main>

        {editable && <aside className="min-w-0">
          <Inspector
            level={level}
            map={selectedMap}
            location={selectedLocation}
            room={selectedRoom}
            object={selectedObject}
            roomCount={locationRooms.length}
            objectCount={roomObjects.length}
            locationScale={
              selectedLocation
                ? Math.min(
                    5,
                    Math.max(
                      1,
                      Math.max(
                        selectedLocation.iconWidth ?? LOCATION_RESOURCE_BASE_SIZE,
                        selectedLocation.iconHeight ?? LOCATION_RESOURCE_BASE_SIZE,
                        LOCATION_RESOURCE_BASE_SIZE,
                      ) / LOCATION_RESOURCE_BASE_SIZE,
                    ),
                  )
                : 1
            }
            onLocationScaleChange={resizeSelectedLocation}
            onLocationScaleCommit={(scale) =>
              void saveSelectedLocationSize(scale)
            }
            visualStyle={
              selectedLocation
                ? getLocationVisualStyle(selectedMap, selectedLocation.id)
                : null
            }
            onVisualStyleChange={updateSelectedLocationVisual}
            onVisualStyleCommit={(style) =>
              void saveSelectedLocationVisual(style)
            }
            onAutoMatch={() => void autoMatchSelectedLocation()}
            onVisualStyleReset={() => void resetSelectedLocationVisual()}
            maskEditing={maskEditing}
            maskTool={maskTool}
            maskLayer={maskLayer}
            maskBrushSize={maskBrushSize}
            maskPointCount={
              selectedLocation
                ? ((maskLayer === "occlusion"
                    ? getLocationOcclusionMask(selectedMap, selectedLocation.id)
                    : getLocationMask(selectedMap, selectedLocation.id)
                  )?.points.length ?? 0)
                : 0
            }
            showMaskOverlay={showMaskOverlay}
            onMaskEditingChange={(value) => {
              setMaskEditing(value);
              maskDraftRef.current = selectedMap?.editorData ?? null;
            }}
            onMaskToolChange={(tool) => {
              setMaskTool(tool);
              setMaskEditing(true);
              maskDraftRef.current = selectedMap?.editorData ?? null;
            }}
            onMaskLayerChange={(layer) => {
              setMaskLayer(layer);
              setMaskEditing(false);
              maskDraftRef.current = selectedMap?.editorData ?? null;
            }}
            onMaskBrushSizeChange={setMaskBrushSize}
            onShowMaskOverlayChange={setShowMaskOverlay}
            onMaskUndo={() => {
              if (!selectedLocation) return;
              const points =
                (maskLayer === "occlusion"
                  ? getLocationOcclusionMask(selectedMap, selectedLocation.id)
                  : getLocationMask(selectedMap, selectedLocation.id)
                )?.points ?? [];
              void replaceSelectedLocationMask(points.slice(0, -1));
            }}
            onMaskClear={() => void replaceSelectedLocationMask([])}
            onEnter={() => {
              if (level === "world" && selectedLocation)
                enterLocation(selectedLocation.id);
              else if (level === "location" && selectedRoom)
                enterRoom(selectedRoom.id);
            }}
            onEdit={() => {
              if (level === "world" && selectedLocation)
                openLocationForm(selectedLocation);
              else if (level === "location" && selectedRoom)
                openRoomForm(selectedRoom);
              else if (level === "room" && selectedObject)
                openObjectForm(selectedObject);
            }}
            onDelete={() => void deleteCurrent()}
          />
        </aside>}
      </div>

      <Dialog open={mapDialog} onOpenChange={setMapDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingMap ? "编辑世界属性" : "新建地图世界"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <Field label="地图名称">
              <Input
                value={mapForm.displayName}
                onChange={(event) =>
                  setMapForm({ ...mapForm, displayName: event.target.value })
                }
                placeholder="例如：海港学院"
              />
            </Field>
            <Field label="世界缩略图">
              <ImageUploadField
                value={mapForm.thumbnailUrl}
                onChange={(url) =>
                  setMapForm({ ...mapForm, thumbnailUrl: url })
                }
                previewSize="lg"
                group="library"
                placeholder="上传世界列表缩略图"
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMapDialog(false)}>
              取消
            </Button>
            <Button
              disabled={saving || !mapForm.displayName.trim()}
              onClick={() => void saveMap()}
            >
              保存地图
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={locationDialog} onOpenChange={setLocationDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingLocation ? "编辑地点" : "添加地点"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <Field label="地点名称">
              <Input
                value={locationForm.displayName}
                onChange={(event) =>
                  setLocationForm({
                    ...locationForm,
                    displayName: event.target.value,
                  })
                }
                placeholder="例如：潮汐图书馆"
              />
            </Field>
            <Field label="地点说明">
              <Textarea
                value={locationForm.description}
                onChange={(event) =>
                  setLocationForm({
                    ...locationForm,
                    description: event.target.value,
                  })
                }
              />
            </Field>
            <Field label="地点类型">
              <Select
                value={locationForm.locationType}
                onChange={(event) =>
                  setLocationForm({
                    ...locationForm,
                    locationType: event.target.value,
                  })
                }
              >
                <SelectItem value="building">建筑</SelectItem>
                <SelectItem value="outdoor">户外区域</SelectItem>
                <SelectItem value="district">街区</SelectItem>
              </Select>
            </Field>
            <Field label="地图建筑透明图">
              <ImageUploadField
                value={locationForm.icon}
                onChange={(url) =>
                  setLocationForm({ ...locationForm, icon: url })
                }
                previewSize="md"
                group="library"
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLocationDialog(false)}>
              取消
            </Button>
            <Button
              disabled={saving || !locationForm.displayName.trim()}
              onClick={() => void saveLocation()}
            >
              保存地点
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={roomDialog} onOpenChange={setRoomDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRoom ? "编辑房间" : "添加房间"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <Field label="房间名称">
              <Input
                value={roomForm.displayName}
                onChange={(event) =>
                  setRoomForm({ ...roomForm, displayName: event.target.value })
                }
                placeholder="例如：阅览室"
              />
            </Field>
            <Field label="房间说明">
              <Textarea
                value={roomForm.description}
                onChange={(event) =>
                  setRoomForm({ ...roomForm, description: event.target.value })
                }
              />
            </Field>
            <Field label="房间类型">
              <Select
                value={roomForm.roomType}
                onChange={(event) =>
                  setRoomForm({ ...roomForm, roomType: event.target.value })
                }
              >
                <SelectItem value="exploration">探索房间</SelectItem>
                <SelectItem value="vn_scene">VN 剧情</SelectItem>
                <SelectItem value="hub">枢纽</SelectItem>
                <SelectItem value="shop">商店</SelectItem>
                <SelectItem value="quest">任务点</SelectItem>
              </Select>
            </Field>
            <Field label="地点场景中的房间入口图">
              <ImageUploadField
                value={roomForm.icon}
                onChange={(url) => setRoomForm({ ...roomForm, icon: url })}
                previewSize="md"
                group="library"
              />
            </Field>
            <Field label="关联 Ink 剧情 ID">
              <Input
                value={roomForm.inkScriptId}
                onChange={(event) =>
                  setRoomForm({ ...roomForm, inkScriptId: event.target.value })
                }
                placeholder="可选"
              />
            </Field>
            <label className="flex items-center justify-between rounded-lg border p-3 text-sm">
              设为地点入口房间
              <Switch
                checked={roomForm.isEntrance}
                onCheckedChange={(checked) =>
                  setRoomForm({ ...roomForm, isEntrance: checked })
                }
              />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoomDialog(false)}>
              取消
            </Button>
            <Button
              disabled={saving || !roomForm.displayName.trim()}
              onClick={() => void saveRoom()}
            >
              保存房间
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={objectDialog} onOpenChange={setObjectDialog}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editingObject ? "编辑探索物品" : "添加探索物品"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="后台名称">
                <Input
                  value={objectForm.title}
                  onChange={(event) =>
                    setObjectForm({ ...objectForm, title: event.target.value })
                  }
                  placeholder="咖啡壶"
                />
              </Field>
              <Field label="交互类型">
                <Select
                  value={objectForm.kind}
                  onChange={(event) =>
                    setObjectForm({
                      ...objectForm,
                      kind: event.target.value as ExplorationObjectKind,
                    })
                  }
                >
                  {Object.entries(OBJECT_KIND_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="英文">
                <Input
                  value={objectForm.english}
                  onChange={(event) =>
                    setObjectForm({ ...objectForm, english: event.target.value })
                  }
                  placeholder="kettle"
                />
              </Field>
              <Field label="中文">
                <Input
                  value={objectForm.translation}
                  onChange={(event) =>
                    setObjectForm({
                      ...objectForm,
                      translation: event.target.value,
                    })
                  }
                  placeholder="水壶"
                />
              </Field>
            </div>
            <Field label="音标">
              <Input
                value={objectForm.pronunciation}
                onChange={(event) =>
                  setObjectForm({
                    ...objectForm,
                    pronunciation: event.target.value,
                  })
                }
                placeholder="/ˈket.əl/"
              />
            </Field>
            <Field label="剧情例句">
              <Input
                value={objectForm.example}
                onChange={(event) =>
                  setObjectForm({ ...objectForm, example: event.target.value })
                }
                placeholder="The kettle is boiling."
              />
            </Field>
            <Field label="学习提示或剧情线索">
              <Textarea
                value={objectForm.prompt}
                onChange={(event) =>
                  setObjectForm({ ...objectForm, prompt: event.target.value })
                }
                placeholder="点击后告诉学习者该观察什么、说什么。"
              />
            </Field>
            <Field label="物品透明图">
              <ImageUploadField
                value={objectForm.imageUrl}
                onChange={(url) =>
                  setObjectForm({ ...objectForm, imageUrl: url })
                }
                previewSize="md"
                group="library"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="显示宽度">
                <Input
                  type="number"
                  value={objectForm.width}
                  onChange={(event) =>
                    setObjectForm({
                      ...objectForm,
                      width: Number(event.target.value),
                    })
                  }
                />
              </Field>
              <Field label="显示高度">
                <Input
                  type="number"
                  value={objectForm.height}
                  onChange={(event) =>
                    setObjectForm({
                      ...objectForm,
                      height: Number(event.target.value),
                    })
                  }
                />
              </Field>
            </div>
            <label className="flex items-center justify-between rounded-lg border p-3 text-sm">
              作为当前房间的必做任务物品
              <Switch
                checked={objectForm.required}
                onCheckedChange={(checked) =>
                  setObjectForm({ ...objectForm, required: checked })
                }
              />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setObjectDialog(false)}>
              取消
            </Button>
            <Button
              disabled={saving || !objectForm.title.trim()}
              onClick={() => void saveObject()}
            >
              保存物品
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!previewId}
        onOpenChange={(open) => !open && setPreviewId("")}
      >
        <DialogContent className="overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="sr-only">
            <DialogTitle>玩家探索预览</DialogTitle>
          </DialogHeader>
          {previewLocation && (
            <PreviewPlace
              image={previewLocation.icon}
              eyebrow="剧情地点"
              title={previewLocation.displayName}
              description={previewLocation.description}
              stats={`${rooms.filter((item) => item.locationId === previewLocation.id).length} 个可进入房间`}
              action="进入地点"
              onAction={() => {
                setPreviewId("");
                enterLocation(previewLocation.id);
              }}
            />
          )}
          {previewRoom && (
            <PreviewPlace
              image={previewRoom.icon}
              eyebrow={previewRoom.isEntrance ? "入口房间" : "探索房间"}
              title={previewRoom.displayName}
              description={previewRoom.description}
              stats={`${getExplorationObjects(selectedMap, previewRoom.id).length} 个可发现物品`}
              action="进入房间"
              onAction={() => {
                setPreviewId("");
                enterRoom(previewRoom.id);
              }}
            />
          )}
          {previewObject && (
            <div className="relative">
              <div className="h-44 bg-muted">
                {previewObject.imageUrl ? (
                  <img
                    src={previewObject.imageUrl}
                    alt=""
                    className="size-full object-contain p-5"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center">
                    <Box className="size-12 text-muted-foreground/30" />
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-4 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Badge variant="secondary">
                      {OBJECT_KIND_LABELS[previewObject.kind]}
                    </Badge>
                    <h2 className="mt-3 text-3xl font-bold tracking-tight">
                      {previewObject.english || previewObject.title}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {previewObject.pronunciation}
                    </p>
                  </div>
                  <Button
                    aria-label="播放英文发音"
                    size="icon"
                    variant="outline"
                    onClick={() =>
                      pronounce(previewObject.english || previewObject.title)
                    }
                  >
                    <Volume2 />
                  </Button>
                </div>
                <p className="text-lg font-medium">{previewObject.translation}</p>
                {previewObject.example && (
                  <button
                    type="button"
                    className="rounded-xl border bg-muted/40 p-4 text-left text-sm leading-6 transition-colors hover:bg-muted"
                    onClick={() => pronounce(previewObject.example ?? "")}
                  >
                    <span className="mb-1 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                      <Headphones />
                      点击听剧情例句
                    </span>
                    {previewObject.example}
                  </button>
                )}
                {previewObject.prompt && (
                  <p className="flex items-start gap-2 text-sm text-muted-foreground">
                    <MessageCircle className="mt-0.5 shrink-0" />
                    {previewObject.prompt}
                  </p>
                )}
                <Button
                  onClick={() => {
                    setDiscovered((items) =>
                      new Set([...items, previewObject.id]),
                    );
                    setPreviewId("");
                    toast.success(`已发现：${previewObject.english || previewObject.title}`);
                  }}
                >
                  <Languages data-icon="inline-start" />
                  标记为已发现
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function VisualSlider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
  onCommit: (value: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3 text-xs">
        <Label>{label}</Label>
        <span className="tabular-nums text-muted-foreground">{format(value)}</span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([next]) => onChange(next ?? value)}
        onValueCommit={([next]) => onCommit(next ?? value)}
        aria-label={label}
      />
    </div>
  );
}

function LayerPanel({
  layers,
  nodes,
  hasBackground,
  activeLayerId,
  selectedCount,
  onSelectLayer,
  onAdd,
  onDelete,
  onMoveUp,
  onMoveDown,
  onAssign,
  onGroup,
  onUngroup,
}: {
  layers: ExplorationLayer[];
  nodes: ExplorationNode[];
  hasBackground: boolean;
  activeLayerId: string;
  selectedCount: number;
  onSelectLayer: (id: string) => void;
  onAdd: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onAssign: () => void;
  onGroup: () => void;
  onUngroup: () => void;
}) {
  const activeLayer = layers.find((layer) => layer.id === activeLayerId);
  const activeIndex = layers.findIndex((layer) => layer.id === activeLayerId);
  const isCustomLayer = !activeLayer?.system;
  return (
    <Card className="w-full min-w-0 overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between p-3 pb-2">
        <div className="flex items-center gap-2">
          <Layers3 />
          <CardTitle className="text-sm">图层</CardTitle>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            aria-label="新增图层"
            onClick={onAdd}
          >
            <Plus />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="删除当前图层"
            disabled={!isCustomLayer}
            onClick={onDelete}
          >
            <Trash2 />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 p-3 pt-0">
        <ScrollArea className="max-h-52">
          <div className="flex flex-col gap-1 pr-2">
            {[...layers].reverse().map((layer) => {
              const count =
                layer.id === BACKGROUND_LAYER_ID
                  ? hasBackground
                    ? 1
                    : 0
                  : nodes.filter((node) => node.layerId === layer.id).length;
              return (
                <Button
                  key={layer.id}
                  variant={
                    layer.id === activeLayerId ? "secondary" : "ghost"
                  }
                  className="w-full justify-start"
                  onClick={() => onSelectLayer(layer.id)}
                >
                  {layer.system === "background" ? (
                    <LockKeyhole data-icon="inline-start" />
                  ) : (
                    <Layers3 data-icon="inline-start" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-left">
                    {layer.name}
                  </span>
                  <Badge variant="outline">{count}</Badge>
                </Button>
              );
            })}
          </div>
        </ScrollArea>
        <Separator />
        <div className="grid grid-cols-2 gap-1.5">
          <Button
            size="sm"
            variant="outline"
            disabled={!isCustomLayer || activeIndex >= layers.length - 1}
            onClick={onMoveUp}
          >
            <ChevronUp data-icon="inline-start" />
            上移
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!isCustomLayer || activeIndex <= 2}
            onClick={onMoveDown}
          >
            <ChevronDown data-icon="inline-start" />
            下移
          </Button>
        </div>
        <Button
          size="sm"
          variant="secondary"
          disabled={
            !selectedCount || activeLayerId === BACKGROUND_LAYER_ID
          }
          onClick={onAssign}
        >
          <Layers3 data-icon="inline-start" />
          将所选放入此层
        </Button>
        <div className="grid grid-cols-2 gap-1.5">
          <Button
            size="sm"
            variant="outline"
            disabled={selectedCount < 2}
            onClick={onGroup}
          >
            <Group data-icon="inline-start" />
            组合
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!selectedCount}
            onClick={onUngroup}
          >
            <Ungroup data-icon="inline-start" />
            取消组合
          </Button>
        </div>
        <p className="text-[11px] leading-4 text-muted-foreground">
          Shift/Ctrl 点击可多选；组合后拖动任一元素会整体移动。
        </p>
      </CardContent>
    </Card>
  );
}

function Inspector({
  level,
  map,
  location,
  room,
  object,
  roomCount,
  objectCount,
  locationScale,
  onLocationScaleChange,
  onLocationScaleCommit,
  visualStyle,
  onVisualStyleChange,
  onVisualStyleCommit,
  onAutoMatch,
  onVisualStyleReset,
  maskEditing,
  maskTool,
  maskLayer,
  maskBrushSize,
  maskPointCount,
  showMaskOverlay,
  onMaskEditingChange,
  onMaskToolChange,
  onMaskLayerChange,
  onMaskBrushSizeChange,
  onShowMaskOverlayChange,
  onMaskUndo,
  onMaskClear,
  onEnter,
  onEdit,
  onDelete,
}: {
  level: StudioLevel;
  map: GameMapData | null;
  location: GameLocationData | null;
  room: GameRoomData | null;
  object: ExplorationObject | null;
  roomCount: number;
  objectCount: number;
  locationScale: number;
  onLocationScaleChange: (scale: number) => void;
  onLocationScaleCommit: (scale: number) => void;
  visualStyle: LocationVisualStyle | null;
  onVisualStyleChange: (style: LocationVisualStyle) => void;
  onVisualStyleCommit: (style: LocationVisualStyle) => void;
  onAutoMatch: () => void;
  onVisualStyleReset: () => void;
  maskEditing: boolean;
  maskTool: MaskTool;
  maskLayer: MaskLayer;
  maskBrushSize: number;
  maskPointCount: number;
  showMaskOverlay: boolean;
  onMaskEditingChange: (value: boolean) => void;
  onMaskToolChange: (tool: MaskTool) => void;
  onMaskLayerChange: (layer: MaskLayer) => void;
  onMaskBrushSizeChange: (value: number) => void;
  onShowMaskOverlayChange: (value: boolean) => void;
  onMaskUndo: () => void;
  onMaskClear: () => void;
  onEnter: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  if (level === "world" && !location) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Map />
            {map?.displayName}
          </CardTitle>
          <CardDescription>
            选择一座建筑，配置入口图、地点场景和房间。
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }
  const title =
    level === "world"
      ? location?.displayName
      : level === "location"
        ? room?.displayName
        : object?.title;
  const description =
    level === "world"
      ? location?.description
      : level === "location"
        ? room?.description
        : object?.prompt;
  const image =
    level === "world"
      ? location?.icon
      : level === "location"
        ? room?.icon
        : object?.imageUrl;
  return (
    <Card className="overflow-hidden">
      {image && (
        <div className="h-36 bg-muted">
          <img src={image} alt="" className="size-full object-contain p-3" />
        </div>
      )}
      <CardHeader>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            {level === "world"
              ? "地点"
              : level === "location"
                ? "房间"
                : "探索物品"}
          </Badge>
          {object?.required && <Badge>必做</Badge>}
        </div>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description || "暂无说明"}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {level === "world" && (
          <>
            <p className="text-xs text-muted-foreground">{roomCount} 个房间</p>
            {location && (
              <>
              <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="location-resource-scale">地点素材大小</Label>
                  <Badge variant="outline">{locationScale.toFixed(1)}×</Badge>
                </div>
                <Slider
                  id="location-resource-scale"
                  min={1}
                  max={5}
                  step={0.1}
                  value={[locationScale]}
                  onValueChange={([value]) =>
                    onLocationScaleChange(value ?? 1)
                  }
                  onValueCommit={([value]) =>
                    onLocationScaleCommit(value ?? 1)
                  }
                  aria-label="地点素材显示倍率"
                />
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>1×</span>
                  <span>
                    {Math.max(
                      LOCATION_RESOURCE_BASE_SIZE,
                      location.iconWidth ?? LOCATION_RESOURCE_BASE_SIZE,
                    )}{" "}
                    ×{" "}
                    {Math.max(
                      LOCATION_RESOURCE_BASE_SIZE,
                      location.iconHeight ?? LOCATION_RESOURCE_BASE_SIZE,
                    )}
                  </span>
                  <span>5×</span>
                </div>
              </div>
              {visualStyle && (
                <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <Label>色彩融合</Label>
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={onVisualStyleReset}
                      >
                        <RotateCcw data-icon="inline-start" />
                        重置
                      </Button>
                      <Button size="sm" variant="outline" onClick={onAutoMatch}>
                        <Sparkles data-icon="inline-start" />
                        自动匹配
                      </Button>
                    </div>
                  </div>
                  <VisualSlider label="亮度" value={visualStyle.brightness} min={0.5} max={1.5} step={0.01} format={(v) => `${Math.round(v * 100)}%`} onChange={(value) => onVisualStyleChange({ ...visualStyle, brightness: value })} onCommit={(value) => onVisualStyleCommit({ ...visualStyle, brightness: value })} />
                  <VisualSlider label="对比度" value={visualStyle.contrast} min={0.5} max={1.5} step={0.01} format={(v) => `${Math.round(v * 100)}%`} onChange={(value) => onVisualStyleChange({ ...visualStyle, contrast: value })} onCommit={(value) => onVisualStyleCommit({ ...visualStyle, contrast: value })} />
                  <VisualSlider label="饱和度" value={visualStyle.saturation} min={0} max={2} step={0.01} format={(v) => `${Math.round(v * 100)}%`} onChange={(value) => onVisualStyleChange({ ...visualStyle, saturation: value })} onCommit={(value) => onVisualStyleCommit({ ...visualStyle, saturation: value })} />
                  <VisualSlider label="色相" value={visualStyle.hue} min={-180} max={180} step={1} format={(v) => `${Math.round(v)}°`} onChange={(value) => onVisualStyleChange({ ...visualStyle, hue: value })} onCommit={(value) => onVisualStyleCommit({ ...visualStyle, hue: value })} />
                  <VisualSlider label="冷暖" value={visualStyle.warmth} min={-1} max={1} step={0.01} format={(v) => v < 0 ? `冷 ${Math.round(-v * 100)}` : `暖 ${Math.round(v * 100)}`} onChange={(value) => onVisualStyleChange({ ...visualStyle, warmth: value })} onCommit={(value) => onVisualStyleCommit({ ...visualStyle, warmth: value })} />
                  <VisualSlider label="阴影" value={visualStyle.shadowOpacity} min={0} max={0.6} step={0.01} format={(v) => `${Math.round(v * 100)}%`} onChange={(value) => onVisualStyleChange({ ...visualStyle, shadowOpacity: value })} onCommit={(value) => onVisualStyleCommit({ ...visualStyle, shadowOpacity: value })} />
                </div>
              )}
              <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3">
                <div className="flex items-center justify-between gap-3">
                  <Label>地点蒙版</Label>
                  <Badge variant="outline">{maskPointCount} 笔</Badge>
                </div>
                <ToggleGroup
                  type="single"
                  value={maskLayer}
                  onValueChange={(value) =>
                    value && onMaskLayerChange(value as MaskLayer)
                  }
                  aria-label="蒙版类型"
                  className="grid grid-cols-2"
                >
                  <ToggleGroupItem value="transparency">
                    透明擦除
                  </ToggleGroupItem>
                  <ToggleGroupItem value="occlusion">
                    前景遮挡
                  </ToggleGroupItem>
                </ToggleGroup>
                <p className="text-[11px] leading-5 text-muted-foreground">
                  {maskLayer === "occlusion"
                    ? "蓝色区域会作为最上层前景，覆盖移入该区域的其他图片。"
                    : "红色区域会从当前地点图片中变为透明。"}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant={
                      maskEditing && maskTool === "erase"
                        ? "default"
                        : "outline"
                    }
                    onClick={() => onMaskToolChange("erase")}
                  >
                    <Eraser data-icon="inline-start" />
                    擦除
                  </Button>
                  <Button
                    variant={
                      maskEditing && maskTool === "restore"
                        ? "default"
                        : "outline"
                    }
                    onClick={() => onMaskToolChange("restore")}
                  >
                    <RotateCcw data-icon="inline-start" />
                    反向恢复
                  </Button>
                </div>
                {maskEditing && (
                  <Button
                    variant="ghost"
                    onClick={() => onMaskEditingChange(false)}
                  >
                    退出蒙版编辑
                  </Button>
                )}
                <div className="flex items-center justify-between gap-3 rounded-md border bg-background p-2.5">
                  <div className="flex flex-col gap-0.5">
                    <Label htmlFor="show-mask-overlay">
                      显示{maskLayer === "occlusion" ? "蓝色" : "红色"}蒙版
                    </Label>
                    <span className="text-[11px] text-muted-foreground">
                      关闭后查看实际透明效果
                    </span>
                  </div>
                  <Switch
                    id="show-mask-overlay"
                    checked={showMaskOverlay}
                    onCheckedChange={onShowMaskOverlayChange}
                    aria-label="显示红色蒙版"
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="location-mask-brush">笔刷大小</Label>
                  <span className="text-xs text-muted-foreground">
                    {maskBrushSize}%
                  </span>
                </div>
                <Slider
                  id="location-mask-brush"
                  min={3}
                  max={20}
                  step={1}
                  value={[maskBrushSize]}
                  onValueChange={([value]) =>
                    onMaskBrushSizeChange(value ?? 8)
                  }
                  aria-label="蒙版笔刷大小"
                />
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    disabled={!maskPointCount}
                    onClick={onMaskUndo}
                  >
                    <Undo2 data-icon="inline-start" />
                    撤销一笔
                  </Button>
                  <Button
                    variant="outline"
                    disabled={!maskPointCount}
                    onClick={onMaskClear}
                  >
                    <Trash2 data-icon="inline-start" />
                    清空蒙版
                  </Button>
                </div>
              </div>
              </>
            )}
          </>
        )}
        {level === "location" && (
          <p className="text-xs text-muted-foreground">{objectCount} 个探索物品</p>
        )}
        {level === "room" && object && (
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-lg font-semibold">{object.english || "未填写英文"}</p>
            <p className="text-sm text-muted-foreground">
              {object.pronunciation} {object.translation}
            </p>
          </div>
        )}
        {level !== "room" && (
          <Button onClick={onEnter}>
            <BookOpen data-icon="inline-start" />
            进入下一层编辑
          </Button>
        )}
        {(level !== "room" || object) && (
          <Button variant="outline" onClick={onEdit}>
            <Edit3 data-icon="inline-start" />
            {level === "room" ? "编辑探索物品" : "编辑属性"}
          </Button>
        )}
        <Button variant="ghost" onClick={onDelete}>
          <Trash2 data-icon="inline-start" />
          删除
        </Button>
      </CardContent>
    </Card>
  );
}

function PreviewPlace({
  image,
  eyebrow,
  title,
  description,
  stats,
  action,
  onAction,
}: {
  image?: string | null;
  eyebrow: string;
  title: string;
  description?: string | null;
  stats: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div>
      <div className="h-56 bg-muted">
        {image ? (
          <img src={image} alt="" className="size-full object-contain p-5" />
        ) : (
          <div className="flex size-full items-center justify-center">
            <MapPin className="size-14 text-muted-foreground/30" />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-4 p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {eyebrow}
          </p>
          <h2 className="mt-2 text-2xl font-bold">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {description || "这里的故事还没有写下。"}
          </p>
        </div>
        <Badge className="w-fit" variant="outline">
          {stats}
        </Badge>
        <Button onClick={onAction}>
          <DoorOpen data-icon="inline-start" />
          {action}
        </Button>
      </div>
    </div>
  );
}
