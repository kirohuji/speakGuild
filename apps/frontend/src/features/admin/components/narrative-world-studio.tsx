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
  Bot,
  Box,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ChevronsUpDown,
  Compass,
  DoorOpen,
  Edit3,
  Eraser,
  Eye,
  EyeOff,
  GraduationCap,
  Headphones,
  Languages,
  Layers3,
  LockKeyhole,
  LockOpen,
  Loader2,
  Map,
  MapPin,
  MessageCircle,
  Moon,
  Plus,
  Pencil,
  Route,
  RotateCcw,
  Group,
  Monitor,
  Smartphone,
  Send,
  Sparkles,
  Sun,
  Sunrise,
  Trash2,
  Undo2,
  Ungroup,
  UserRound,
  Volume2,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  generateSceneRoleplayTurn,
  getStory,
  listCharacters,
  listLibraryChunks,
  listLibraryPatterns,
  listLibraryVocabularies,
  listStories,
  listLocations,
  listMaps,
  listRooms,
  updateLocation,
  updateMap,
  updateRoom,
  type GameLocationData,
  type GameMapData,
  type GameRoomData,
  type ChunkFull,
  type GameCharacter,
  type SentencePatternFull,
  type StoryData,
  type VocabularyFull,
} from "../api-content-admin";
import { ImageUploadField } from "./image-upload-field";
import {
  SpritesheetZipUploadField,
  type SpritesheetImportValue,
} from "./spritesheet-zip-upload-field";
import { VnStoryPreview } from "./vn-story-preview";
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
  type ExplorationMediaType,
  type LearningResourceType,
  type SceneInteractionType,
  type ExplorationLayer,
} from "./maps/exploration-map-model";

type StudioLevel = "world" | "location" | "room";
type TimeOfDay = "day" | "golden" | "night";
type ObjectFilter = "all" | "required" | "undiscovered";
type MaskTool = "erase" | "restore";
type MaskLayer = "transparency" | "occlusion";
type PreviewOrientation = "portrait" | "landscape";

const EMPTY_OBJECT: Omit<ExplorationObject, "id" | "roomId"> = {
  parentNodeId: "",
  anchorMode: "scene",
  interactionType: "learning",
  title: "",
  english: "",
  translation: "",
  pronunciation: "",
  example: "",
  prompt: "",
  imageUrl: "",
  mediaType: "image",
  spritesheetUrl: "",
  animationName: "",
  animationNames: [],
  animationFps: 12,
  animationLoop: true,
  kind: "vocabulary",
  resourceType: "vocabulary",
  resourceId: "",
  characterId: "",
  characterMode: "ai",
  inkScriptId: "",
  openingLine: "",
  targetRoomId: "",
  x: 50,
  y: 55,
  width: 110,
  height: 110,
  required: false,
  hidden: false,
};

const OBJECT_KIND_LABELS: Record<ExplorationObjectKind, string> = {
  vocabulary: "词汇物品",
  phrase: "句块热点",
  pattern: "句型热点",
  reading: "阅读线索",
  listening: "听力物品",
  clue: "剧情线索",
  quest: "任务物品",
};

const LOCATION_RESOURCE_BASE_SIZE = 80;

function SceneElementIcon({ node }: { node: ExplorationNode }) {
  if (node.kind === "location") return <MapPin className="shrink-0" />;
  if (node.kind === "room") return <DoorOpen className="shrink-0" />;
  if (node.kind === "character") return <UserRound className="shrink-0" />;
  if (node.kind === "exit") return <Route className="shrink-0" />;
  if (node.resourceType === "chunk") {
    return <MessageCircle className="shrink-0" />;
  }
  if (node.resourceType === "pattern") {
    return <GraduationCap className="shrink-0" />;
  }
  if (node.objectKind === "reading") {
    return <BookOpen className="shrink-0" />;
  }
  if (node.objectKind === "listening") {
    return <Headphones className="shrink-0" />;
  }
  if (node.objectKind === "clue" || node.objectKind === "quest") {
    return <Sparkles className="shrink-0" />;
  }
  return <Languages className="shrink-0" />;
}

function ExplorationMediaPreview({
  object,
  className,
}: {
  object: ExplorationObject;
  className: string;
}) {
  if (!object.imageUrl) return null;
  return (
    <MediaUrlPreview
      url={object.imageUrl}
      video={object.mediaType === "video"}
      className={cn(
        className,
        object.mediaType === "spritesheet" &&
          "object-contain [image-rendering:pixelated]",
      )}
    />
  );
}

function MediaUrlPreview({
  url,
  className,
  video = /\.(mp4|webm|ogg|mov|m4v)(?:[?#]|$)/i.test(url) ||
    /[#&?]media=video(?:&|$)/i.test(url),
}: {
  url: string;
  className: string;
  video?: boolean;
}) {
  if (video) {
    return (
      <video
        src={url}
        muted
        loop
        autoPlay
        playsInline
        className={className}
      />
    );
  }
  return <img src={url} alt="" className={className} />;
}

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
  const [inkStories, setInkStories] = useState<StoryData[]>([]);
  const [inkStoriesLoading, setInkStoriesLoading] = useState(false);
  const [inkStoryPickerOpen, setInkStoryPickerOpen] = useState(false);
  const [characters, setCharacters] = useState<GameCharacter[]>([]);
  const [vocabularyResources, setVocabularyResources] = useState<VocabularyFull[]>([]);
  const [chunkResources, setChunkResources] = useState<ChunkFull[]>([]);
  const [patternResources, setPatternResources] = useState<SentencePatternFull[]>([]);
  const [interactionResourcesLoading, setInteractionResourcesLoading] =
    useState(false);
  const [interactionResourcesLoaded, setInteractionResourcesLoaded] =
    useState(false);
  const [previewStory, setPreviewStory] = useState<StoryData | null>(null);
  const [roleplayHistory, setRoleplayHistory] = useState<
    Array<{ speaker: "npc" | "user"; text: string }>
  >([]);
  const [roleplayInput, setRoleplayInput] = useState("");
  const [roleplayCoach, setRoleplayCoach] = useState("");
  const [roleplayLoading, setRoleplayLoading] = useState(false);
  const maskDraftRef = useRef<any>(null);

  const [mapDialog, setMapDialog] = useState(false);
  const [locationDialog, setLocationDialog] = useState(false);
  const [roomDialog, setRoomDialog] = useState(false);
  const [objectDialog, setObjectDialog] = useState(false);
  const [addElementMenuOpen, setAddElementMenuOpen] = useState(false);
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

  const loadInkStories = useCallback(async () => {
    if (inkStoriesLoading || inkStories.length) return;
    setInkStoriesLoading(true);
    try {
      const firstPage = await listStories({
        scope: "narrative",
        page: 1,
        pageSize: 50,
      });
      const remainingPages =
        firstPage.totalPages > 1
          ? await Promise.all(
              Array.from({ length: firstPage.totalPages - 1 }, (_, index) =>
                listStories({
                  scope: "narrative",
                  page: index + 2,
                  pageSize: 50,
                }),
              ),
            )
          : [];
      setInkStories([
        ...firstPage.items,
        ...remainingPages.flatMap((page) => page.items),
      ]);
    } catch {
      toast.error("Ink 剧情列表加载失败");
    } finally {
      setInkStoriesLoading(false);
    }
  }, [inkStories.length, inkStoriesLoading]);

  useEffect(() => {
    if (roomDialog && roomForm.roomType === "vn_scene") {
      void loadInkStories();
    }
  }, [loadInkStories, roomDialog, roomForm.roomType]);

  const loadInteractionResources = useCallback(async () => {
    if (interactionResourcesLoading || interactionResourcesLoaded) return;
    setInteractionResourcesLoading(true);
    try {
      const [nextCharacters, vocabPage, chunkPage, patternPage] =
        await Promise.all([
          listCharacters(),
          listLibraryVocabularies({ page: 1, pageSize: 100 }),
          listLibraryChunks({ page: 1, pageSize: 100 }),
          listLibraryPatterns({ page: 1, pageSize: 100 }),
        ]);
      const [remainingVocabPages, remainingChunkPages, remainingPatternPages] =
        await Promise.all([
          Promise.all(
            Array.from(
              { length: Math.max(0, vocabPage.totalPages - 1) },
              (_, index) =>
                listLibraryVocabularies({
                  page: index + 2,
                  pageSize: 100,
                }),
            ),
          ),
          Promise.all(
            Array.from(
              { length: Math.max(0, chunkPage.totalPages - 1) },
              (_, index) =>
                listLibraryChunks({ page: index + 2, pageSize: 100 }),
            ),
          ),
          Promise.all(
            Array.from(
              { length: Math.max(0, patternPage.totalPages - 1) },
              (_, index) =>
                listLibraryPatterns({ page: index + 2, pageSize: 100 }),
            ),
          ),
        ]);
      setCharacters(nextCharacters);
      setVocabularyResources([
        ...vocabPage.items,
        ...remainingVocabPages.flatMap((page) => page.items),
      ]);
      setChunkResources([
        ...chunkPage.items,
        ...remainingChunkPages.flatMap((page) => page.items),
      ]);
      setPatternResources([
        ...patternPage.items,
        ...remainingPatternPages.flatMap((page) => page.items),
      ]);
      setInteractionResourcesLoaded(true);
    } catch {
      toast.error("互动资源加载失败");
    } finally {
      setInteractionResourcesLoading(false);
    }
  }, [
    interactionResourcesLoaded,
    interactionResourcesLoading,
  ]);

  useEffect(() => {
    if (objectDialog) void loadInteractionResources();
  }, [loadInteractionResources, objectDialog]);

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
  const selectedAttachmentParent =
    level === "world"
      ? selectedLocation
      : level === "location"
        ? selectedRoom
        : null;

  const layerScope =
    level === "world"
      ? "world"
      : level === "location"
        ? `location:${locationId}`
        : `room:${roomId}`;
  const sceneInteractions = getExplorationObjects(selectedMap, layerScope);
  const selectedObject =
    sceneInteractions.find((item) => item.id === objectId) ?? null;
  const visibleObjects = sceneInteractions.filter((item) => {
    if (objectFilter === "required") return item.required;
    if (objectFilter === "undiscovered") return !discovered.has(item.id);
    return true;
  });
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
        layerHidden:
          layers.find((layer) => layer.id === layerId)?.hidden ?? false,
        layerLocked:
          layers.find((layer) => layer.id === layerId)?.locked ?? false,
        groupId: getExplorationNodeGroupId(selectedMap?.editorData, node.id),
      };
    };
    const interactionNodes = visibleObjects.map((item) =>
      withLayer({
        id: item.id,
        title: item.english || item.title,
        subtitle: `${item.parentNodeId ? "附着 · " : ""}${
          item.interactionType === "character"
            ? item.characterMode === "ink"
              ? "Ink 剧情"
              : "AI 自由对话"
            : item.interactionType === "exit"
              ? `前往${rooms.find((room) => room.id === item.targetRoomId)?.displayName ?? "其他房间"}`
              : item.translation || OBJECT_KIND_LABELS[item.kind]
        }`,
        imageUrl: item.imageUrl,
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
        kind:
          item.interactionType === "character"
            ? ("character" as const)
            : item.interactionType === "exit"
              ? ("exit" as const)
              : ("learning" as const),
        required: item.required,
        hidden: item.hidden,
        resourceType: item.resourceType,
        objectKind: item.kind,
        mediaType: item.mediaType ?? "image",
        spritesheetUrl: item.spritesheetUrl,
        animationName: item.animationName,
        animationFps: item.animationFps,
        animationLoop: item.animationLoop,
      }),
    );
    if (level === "world") {
      return [...mapLocations.map((location) => withLayer({
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
      })), ...interactionNodes];
    }
    if (level === "location") {
      return [...locationRooms.map((room, index) => withLayer({
        id: room.id,
        title: room.displayName,
        subtitle: room.isEntrance ? "入口房间" : room.roomType,
        imageUrl: room.icon,
        ...getRoomLayout(selectedMap, locationId, room.id, index),
        kind: "room",
        disabled: room.disabled,
        hidden: room.hidden,
      })), ...interactionNodes];
    }
    return interactionNodes;
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
    objectId ||
    (level === "world" ? locationId : level === "location" ? roomId : "");
  const effectiveSelectedNodeIds = selectedNodeIds.length
    ? selectedNodeIds
    : selectedNodeId
      ? [selectedNodeId]
      : [];
  const nodeBreathing = Boolean(
    selectedMap?.editorData?.preview?.nodeBreathing,
  );
  const backgroundLayerHidden =
    layers.find((layer) => layer.id === BACKGROUND_LAYER_ID)?.hidden ?? false;

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

  const enterLocationPreview = (id: string) => {
    const entranceRoom = rooms.find(
      (room) =>
        room.locationId === id &&
        room.isEntrance &&
        !room.disabled &&
        !room.hidden,
    );
    setPreviewId("");
    setLocationId(id);
    setObjectId("");
    setFocusNodeId("");
    if (entranceRoom) {
      setRoomId(entranceRoom.id);
      setLevel("room");
      return;
    }
    setRoomId("");
    setLevel("location");
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
    if (
      node?.kind === "learning" ||
      node?.kind === "character" ||
      node?.kind === "exit" ||
      node?.kind === "object"
    ) {
      setObjectId(id);
      const interaction = sceneInteractions.find((item) => item.id === id);
      if (level === "world") setLocationId(interaction?.parentNodeId ?? "");
      if (level === "location") setRoomId(interaction?.parentNodeId ?? "");
    } else {
      setObjectId("");
      if (level === "world") setLocationId(id);
      else if (level === "location") setRoomId(id);
    }
    if (!editable) setFocusNodeId(id);
  };

  const selectSceneRoot = () => {
    setObjectId("");
    setSelectedNodeIds([]);
    setFocusNodeId("");
    if (level === "world") {
      setLocationId("");
      setRoomId("");
    } else if (level === "location") {
      setRoomId("");
    }
  };

  const openNode = (id: string) => {
    if (editable) return;
    const interaction = sceneInteractions.find((item) => item.id === id);
    if (interaction?.interactionType === "exit" && interaction.targetRoomId) {
      const targetRoom = rooms.find(
        (room) =>
          room.id === interaction.targetRoomId &&
          !room.disabled &&
          !room.hidden,
      );
      if (targetRoom) {
        setPreviewId("");
        setLocationId(targetRoom.locationId);
        enterRoom(targetRoom.id);
        return;
      }
    }
    if (interaction) {
      if (interaction.interactionType === "character") {
        void loadInteractionResources();
      }
      setPreviewId(id);
      setFocusNodeId(id);
      setRoleplayHistory(
        interaction.interactionType === "character" &&
          interaction.openingLine
          ? [{ speaker: "npc", text: interaction.openingLine }]
          : [],
      );
      setRoleplayCoach("");
      if (
        interaction.interactionType === "character" &&
        interaction.characterMode === "ink" &&
        interaction.inkScriptId
      ) {
        setPreviewStory(null);
        void getStory(interaction.inkScriptId)
          .then(setPreviewStory)
          .catch(() => toast.error("Ink 剧情加载失败"));
      } else {
        setPreviewStory(null);
      }
      return;
    }
    setPreviewId(id);
    setFocusNodeId(id);
  };

  const moveNode = async (id: string, x: number, y: number) => {
    const activeNode = nodes.find((item) => item.id === id);
    if (!activeNode || activeNode.layerLocked) return;
    const groupedNodes = activeNode.groupId
      ? nodes.filter(
          (item) =>
            item.groupId === activeNode.groupId && !item.layerLocked,
        )
      : [activeNode];
    const groupedIds = new Set(groupedNodes.map((node) => node.id));
    const attachedNodes = nodes.filter((node) =>
      sceneInteractions.some(
        (interaction) =>
          interaction.id === node.id &&
          interaction.parentNodeId &&
          groupedIds.has(interaction.parentNodeId),
      ),
    );
    const movedNodes = [
      ...groupedNodes,
      ...attachedNodes.filter((node) => !groupedIds.has(node.id)),
    ];
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
    const interactionPositions = [...positions].filter(([nodeId]) =>
      sceneInteractions.some((item) => item.id === nodeId),
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
          [...positions]
            .filter(([nodeId]) =>
              mapLocations.some((location) => location.id === nodeId),
            )
            .map(([nodeId, position]) =>
            updateLocation(nodeId, {
              posX: position.x,
              posY: position.y,
            }),
          ),
        );
        if (selectedMap && interactionPositions.length) {
          let nextEditorData = selectedMap.editorData;
          for (const [nodeId, position] of interactionPositions) {
            nextEditorData = updateExplorationObjectPosition(
              nextEditorData,
              layerScope,
              nodeId,
              position.x,
              position.y,
            );
          }
          await persistEditorData(nextEditorData);
        }
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
        if (sceneInteractions.some((item) => item.id === nodeId)) {
          nextEditorData = updateExplorationObjectPosition(
            nextEditorData,
            layerScope,
            nodeId,
            position.x,
            position.y,
          );
          continue;
        }
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
        layerScope,
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

  const updateLayer = async (
    layerId: string,
    patch: Partial<Pick<ExplorationLayer, "name" | "hidden" | "locked">>,
  ) => {
    if (!selectedMap) return;
    const target = layers.find((layer) => layer.id === layerId);
    if (!target) return;
    const nextLayers = layers.map((layer) =>
      layer.id === layerId
        ? {
            ...layer,
            ...patch,
            name:
              patch.name !== undefined
                ? patch.name.trim() || layer.name
                : layer.name,
            locked:
              layer.system === "background"
                ? true
                : patch.locked ?? layer.locked,
          }
        : layer,
    );
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
      if (roomForm.isEntrance) {
        await Promise.all(
          locationRooms
            .filter(
              (room) => room.isEntrance && room.id !== editingRoom?.id,
            )
            .map((room) => updateRoom(room.id, { isEntrance: false })),
        );
      }
      const roomPayload = {
        ...roomForm,
        inkScriptId:
          roomForm.roomType === "vn_scene" && roomForm.inkScriptId
            ? roomForm.inkScriptId
            : null,
      };
      if (editingRoom) await updateRoom(editingRoom.id, roomPayload);
      else
        await createRoom({
          ...roomPayload,
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

  const openObjectForm = (
    object?: ExplorationObject,
    parentNodeId = "",
  ) => {
    const parentNode = nodes.find((node) => node.id === parentNodeId);
    setEditingObject(object ?? null);
    setObjectForm(
      object
        ? {
            parentNodeId: object.parentNodeId ?? "",
            anchorMode: object.parentNodeId ? "attached" : "scene",
            interactionType: object.interactionType ?? "learning",
            title: object.title,
            english: object.english ?? "",
            translation: object.translation ?? "",
            pronunciation: object.pronunciation ?? "",
            example: object.example ?? "",
            prompt: object.prompt ?? "",
            imageUrl: object.imageUrl ?? "",
            mediaType: object.mediaType ?? "image",
            spritesheetUrl: object.spritesheetUrl ?? "",
            animationName: object.animationName ?? "",
            animationNames: object.animationNames ?? [],
            animationFps: object.animationFps ?? 12,
            animationLoop: object.animationLoop ?? true,
            kind: object.kind,
            resourceType: object.resourceType ?? "vocabulary",
            resourceId: object.resourceId ?? "",
            characterId: object.characterId ?? "",
            characterMode: object.characterMode ?? "ai",
            inkScriptId: object.inkScriptId ?? "",
            openingLine: object.openingLine ?? "",
            targetRoomId: object.targetRoomId ?? "",
            x: object.x,
            y: object.y,
            width: object.width,
            height: object.height,
            required: object.required,
            hidden: object.hidden,
          }
        : {
            ...EMPTY_OBJECT,
            parentNodeId,
            anchorMode: parentNodeId ? "attached" : "scene",
            x: parentNode ? Math.min(94, parentNode.x + 8) : EMPTY_OBJECT.x,
            y: parentNode ? Math.min(94, parentNode.y + 6) : EMPTY_OBJECT.y,
          },
    );
    setObjectDialog(true);
  };

  const bindLearningResource = (
    resourceType: LearningResourceType,
    resourceId: string,
  ) => {
    if (resourceType === "vocabulary") {
      const resource = vocabularyResources.find((item) => item.id === resourceId);
      if (!resource) return;
      const firstExample = Array.isArray(resource.examples)
        ? resource.examples[0]
        : undefined;
      setObjectForm((current) => ({
        ...current,
        resourceType,
        resourceId,
        kind: "vocabulary",
        title: resource.word,
        english: resource.word,
        translation: resource.meaning,
        pronunciation: resource.phoneticUs ?? resource.phoneticUk ?? "",
        example: firstExample?.en ?? "",
      }));
      return;
    }
    if (resourceType === "chunk") {
      const resource = chunkResources.find((item) => item.id === resourceId);
      if (!resource) return;
      setObjectForm((current) => ({
        ...current,
        resourceType,
        resourceId,
        kind: "phrase",
        title: resource.text,
        english: resource.text,
        translation: resource.meaning,
        pronunciation: "",
        example: resource.examples?.[0]?.en ?? "",
      }));
      return;
    }
    const resource = patternResources.find((item) => item.id === resourceId);
    if (!resource) return;
    const examples = Array.isArray(resource.examples) ? resource.examples : [];
    setObjectForm((current) => ({
      ...current,
      resourceType,
      resourceId,
      kind: "pattern",
      title: resource.pattern,
      english: resource.pattern,
      translation: resource.meaning ?? "",
      pronunciation: "",
      example: examples[0]?.en ?? examples[0]?.example ?? "",
    }));
  };

  const saveObject = async () => {
    if (!selectedMap || !objectForm.title.trim()) return;
    if (
      objectForm.interactionType === "learning" &&
      !objectForm.resourceId
    ) {
      toast.error("请先绑定一个已有的单词、句块或句型");
      return;
    }
    if (
      objectForm.interactionType === "character" &&
      !objectForm.characterId
    ) {
      toast.error("请先绑定一个角色");
      return;
    }
    if (
      objectForm.interactionType === "character" &&
      objectForm.characterMode === "ink" &&
      !objectForm.inkScriptId
    ) {
      toast.error("请先绑定 Ink 剧情");
      return;
    }
    if (
      objectForm.interactionType === "exit" &&
      !objectForm.targetRoomId
    ) {
      toast.error("请先选择出口要前往的房间");
      return;
    }
    const object: ExplorationObject = {
      ...objectForm,
      parentNodeId: objectForm.parentNodeId || undefined,
      anchorMode: objectForm.parentNodeId ? "attached" : "scene",
      id:
        editingObject?.id ??
        `${makeExplorationKey(objectForm.english || objectForm.title, "object")}_${Date.now().toString(36)}`,
      scopeKey: layerScope,
      roomId: level === "room" ? selectedRoom?.id : undefined,
    };
    setSaving(true);
    try {
      let nextEditorData = upsertExplorationObject(
        selectedMap.editorData,
        layerScope,
        object,
      );
      if (!editingObject && object.parentNodeId) {
        nextEditorData = updateExplorationNodeLayers(
          nextEditorData,
          [object.id],
          getExplorationNodeLayerId(
            selectedMap.editorData,
            object.parentNodeId,
          ),
        );
      }
      await persistEditorData(nextEditorData);
      setObjectId(object.id);
      setObjectDialog(false);
      toast.success("互动热点已保存");
    } finally {
      setSaving(false);
    }
  };

  const deleteCurrent = async () => {
    if (selectedObject && selectedMap) {
      await persistEditorData(
        removeExplorationObject(
          selectedMap.editorData,
          layerScope,
          selectedObject.id,
        ),
      );
      setObjectId("");
      toast.success("互动热点已删除");
    } else if (level === "world" && selectedLocation) {
      if (!window.confirm(`删除地点“${selectedLocation.displayName}”及其房间？`))
        return;
      const attachedInteractions = sceneInteractions.filter(
        (interaction) => interaction.parentNodeId === selectedLocation.id,
      );
      if (selectedMap && attachedInteractions.length) {
        let nextEditorData = selectedMap.editorData;
        for (const interaction of attachedInteractions) {
          nextEditorData = removeExplorationObject(
            nextEditorData,
            layerScope,
            interaction.id,
          );
        }
        await persistEditorData(nextEditorData);
      }
      await deleteLocation(selectedLocation.id);
      setLocationId("");
      await load();
    } else if (level === "location" && selectedRoom) {
      if (!window.confirm(`删除房间“${selectedRoom.displayName}”？`)) return;
      const attachedInteractions = sceneInteractions.filter(
        (interaction) => interaction.parentNodeId === selectedRoom.id,
      );
      if (selectedMap && attachedInteractions.length) {
        let nextEditorData = selectedMap.editorData;
        for (const interaction of attachedInteractions) {
          nextEditorData = removeExplorationObject(
            nextEditorData,
            layerScope,
            interaction.id,
          );
        }
        await persistEditorData(nextEditorData);
      }
      await deleteRoom(selectedRoom.id);
      setRoomId("");
      await load();
    }
  };

  const previewObject =
    sceneInteractions.find((item) => item.id === previewId) ?? null;
  const previewParentId = previewObject?.parentNodeId;
  const previewLocation =
    level === "world"
      ? (mapLocations.find(
          (item) => item.id === (previewParentId ?? previewId),
        ) ?? null)
      : null;
  const previewRoom =
    level === "location"
      ? (locationRooms.find(
          (item) => item.id === (previewParentId ?? previewId),
        ) ?? null)
      : null;
  const previewPlaceId = previewLocation?.id ?? previewRoom?.id ?? "";
  const previewPlaceInteractions = previewPlaceId
    ? sceneInteractions.filter(
        (interaction) =>
          interaction.parentNodeId === previewPlaceId && !interaction.hidden,
      )
    : [];

  const pronounce = (text: string) => {
    if (!text || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.86;
    window.speechSynthesis.speak(utterance);
  };

  const submitRoleplayTurn = async () => {
    if (
      !previewObject ||
      previewObject.interactionType !== "character" ||
      !roleplayInput.trim() ||
      roleplayLoading
    )
      return;
    const character = characters.find(
      (item) => item.id === previewObject.characterId,
    );
    if (!character) {
      toast.error("该热点未绑定有效角色");
      return;
    }
    const userText = roleplayInput.trim();
    const historyBeforeReply = [
      ...roleplayHistory,
      { speaker: "user" as const, text: userText },
    ];
    setRoleplayHistory(historyBeforeReply);
    setRoleplayInput("");
    setRoleplayLoading(true);
    try {
      const result = await generateSceneRoleplayTurn({
        characterName: character.displayName,
        characterRole: character.role,
        characterPersonality: character.personality ?? undefined,
        sceneTitle:
          selectedRoom?.displayName ??
          selectedLocation?.displayName ??
          selectedMap?.displayName ??
          "English learning scene",
        scenePrompt: previewObject.prompt,
        userText,
        history: roleplayHistory,
        learningTargets: sceneInteractions
          .filter(
            (item) =>
              (item.interactionType ?? "learning") === "learning" &&
              item.resourceId &&
              item.resourceType,
          )
          .map((item) => ({
            id: item.resourceId!,
            type: item.resourceType!,
            text: item.english || item.title,
            meaning: item.translation,
          })),
      });
      setRoleplayHistory([
        ...historyBeforeReply,
        { speaker: "npc", text: result.reply },
      ]);
      setRoleplayCoach(result.coach);
    } catch {
      setRoleplayHistory(roleplayHistory);
      toast.error("AI 角色暂时无法回应");
    } finally {
      setRoleplayLoading(false);
    }
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
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
      <Card className="shrink-0 overflow-hidden border border-border/60 bg-card/95">
        <CardContent className="flex flex-wrap items-center gap-2 p-2.5">
          <Select
            value={mapId}
            onChange={(event) => {
              setMapId(event.target.value);
              setLevel("world");
              setLocationId("");
              setRoomId("");
              setObjectId("");
            }}
            className="h-9 w-[200px] bg-background"
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
          <Separator orientation="vertical" className="mx-0.5 h-7" />
          {level !== "world" && (
            <Button size="sm" variant="ghost" onClick={goBack}>
              <ArrowLeft data-icon="inline-start" />
              返回上一级
            </Button>
          )}
          <div className="min-w-[180px] flex-1 border-l border-border/60 pl-3">
            <p className="truncate text-sm font-semibold">
              {selectedMap?.displayName}
              {selectedLocation ? ` / ${selectedLocation.displayName}` : ""}
              {selectedRoom ? ` / ${selectedRoom.displayName}` : ""}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
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
          {!editable && (
            <Button
              size="sm"
              variant="outline"
              disabled={!nodes.length}
              onClick={() => (touring ? setTouring(false) : startTour())}
            >
              <Route data-icon="inline-start" />
              {touring ? "停止导览" : "自动导览"}
            </Button>
          )}
          {editable && (
            <Popover
              open={addElementMenuOpen}
              onOpenChange={setAddElementMenuOpen}
            >
              <PopoverTrigger asChild>
                <Button size="sm">
                  <Plus data-icon="inline-start" />
                  添加元素
                  <ChevronDown data-icon="inline-end" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 p-2">
                <div className="flex flex-col gap-1">
                  {level !== "room" && (
                    <Button
                      variant="ghost"
                      className="h-auto justify-start gap-3 px-2.5 py-2 text-left"
                      onClick={() => {
                        setAddElementMenuOpen(false);
                        if (level === "world") openLocationForm();
                        else openRoomForm();
                      }}
                    >
                      {level === "world" ? <MapPin /> : <DoorOpen />}
                      <span>
                        <span className="block text-sm font-medium">
                          {level === "world" ? "地点元素" : "房间元素"}
                        </span>
                        <span className="block text-[11px] font-normal text-muted-foreground">
                          点击后可进入下一层继续编辑
                        </span>
                      </span>
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    className="h-auto justify-start gap-3 px-2.5 py-2 text-left"
                    onClick={() => {
                      setAddElementMenuOpen(false);
                      openObjectForm(
                        undefined,
                        selectedAttachmentParent?.id ?? "",
                      );
                    }}
                  >
                    <Box />
                    <span>
                      <span className="block text-sm font-medium">
                        普通场景元素
                      </span>
                      <span className="block text-[11px] font-normal text-muted-foreground">
                        学习资源、角色、线索或出口
                      </span>
                    </span>
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          )}
        </CardContent>
      </Card>

      {level === "room" && (
        <div className="flex shrink-0 flex-wrap items-center gap-3 rounded-lg border border-border/60 bg-card px-3 py-2">
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
            已发现 {sceneInteractions.filter((object) => discovered.has(object.id)).length}/
            {sceneInteractions.length}
          </span>
          <Progress
            value={
              sceneInteractions.length
                ? (sceneInteractions.filter((object) => discovered.has(object.id)).length /
                    sceneInteractions.length) *
                  100
                : 0
            }
            className="h-2 w-32"
          />
        </div>
      )}

      <div
        className={cn(
          "min-h-0 min-w-0 flex-1 gap-3 overflow-hidden",
          editable
            ? "grid grid-cols-[clamp(180px,17vw,220px)_minmax(0,1fr)_clamp(210px,20vw,250px)] 2xl:grid-cols-[250px_minmax(0,1fr)_280px]"
            : "flex justify-center overflow-y-auto py-2",
        )}
      >
        {editable && (
          <div className="flex h-full min-w-0 flex-col gap-2 overflow-y-auto pr-1">
            <Card className="min-w-0 shrink-0 border border-border/60">
              <CardContent className="grid grid-cols-[96px_minmax(0,1fr)] gap-2 p-2">
                <div className="flex items-center">
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
                </div>
                <div className="grid min-w-0 grid-rows-2 gap-1.5">
                  <div className="grid grid-cols-[30px_minmax(0,1fr)] items-center gap-1.5">
                    <Label className="text-[10px] text-muted-foreground">宽度</Label>
                    <Input
                      className="h-7 px-2 text-xs tabular-nums"
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
                  </div>
                  <div className="grid grid-cols-[30px_minmax(0,1fr)] items-center gap-1.5">
                    <Label className="text-[10px] text-muted-foreground">高度</Label>
                    <Input
                      className="h-7 px-2 text-xs tabular-nums"
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
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="min-w-0 shrink-0 border border-border/60">
              <CardHeader className="p-2 pb-1">
                <CardTitle className="text-xs">
                  {level === "world"
                    ? "世界场景元素"
                    : level === "location"
                      ? "地点场景元素"
                      : "房间互动元素"}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2 pt-0">
                <ScrollArea className="h-[132px]">
                  <div className="flex flex-col gap-0.5 pr-1">
                    <button
                      type="button"
                      className={cn(
                        "mb-1 flex h-8 w-full items-center gap-1.5 rounded-md border px-2 text-left text-xs font-medium transition-colors [&_svg]:size-3.5",
                        !objectId &&
                          ((level === "world" && !locationId) ||
                            (level === "location" && !roomId) ||
                            level === "room")
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-border/60 bg-muted/30 hover:bg-muted",
                      )}
                      onClick={selectSceneRoot}
                    >
                      {level === "world" ? (
                        <Map className="shrink-0" />
                      ) : level === "location" ? (
                        <MapPin className="shrink-0" />
                      ) : (
                        <DoorOpen className="shrink-0" />
                      )}
                      <span className="min-w-0 flex-1 truncate">
                        {level === "world"
                          ? "当前世界场景"
                          : level === "location"
                            ? "当前地点场景"
                            : "当前房间场景"}
                      </span>
                      <Badge
                        variant="outline"
                        className="h-5 rounded-full px-1.5 text-[9px]"
                      >
                        场景
                      </Badge>
                    </button>
                    {nodes.map((node) => (
                      <button
                        key={node.id}
                        type="button"
                        className={cn(
                          "flex h-7 w-full items-center gap-1.5 rounded-md px-2 text-left text-xs transition-colors [&_svg]:size-3.5",
                          effectiveSelectedNodeIds.includes(node.id)
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-muted",
                          node.layerHidden && "opacity-45",
                        )}
                        onClick={(event) =>
                          selectNode(
                            node.id,
                            event.shiftKey || event.ctrlKey || event.metaKey,
                          )
                        }
                        onDoubleClick={() => {
                          if (node.kind === "location") enterLocation(node.id);
                          else if (node.kind === "room") enterRoom(node.id);
                        }}
                      >
                        <SceneElementIcon node={node} />
                        <span className="min-w-0 flex-1 truncate">
                          {node.title}
                        </span>
                        {node.groupId && <Group className="shrink-0" />}
                        {node.layerLocked && (
                          <LockKeyhole className="shrink-0" />
                        )}
                        {node.layerHidden && <EyeOff className="shrink-0" />}
                        {node.required && <Sparkles className="shrink-0" />}
                      </button>
                    ))}
                    {!nodes.length && (
                      <p className="px-2 py-8 text-center text-[11px] text-muted-foreground">
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
              onRename={(id, name) => void updateLayer(id, { name })}
              onToggleLock={(id, locked) =>
                void updateLayer(id, { locked })
              }
              onToggleVisibility={(id, hidden) =>
                void updateLayer(id, { hidden })
              }
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
            "min-h-0 min-w-0 max-w-full overflow-hidden",
            editable && "h-full max-h-full rounded-xl border border-border/60 bg-slate-950/95 p-1 shadow-sm",
            !editable &&
              (previewOrientation === "landscape"
                ? "w-full max-w-[860px] rounded-[1.9rem] border-[7px] border-slate-950 bg-slate-950 p-1 shadow-2xl ring-1 ring-white/10"
                : "w-full max-w-[410px] rounded-[2.35rem] border-[8px] border-slate-950 bg-slate-950 p-1 shadow-2xl ring-1 ring-white/10"),
          )}
        >
          <ExplorationPixiCanvas
            key={
              editable
                ? `edit-${level}`
                : `preview-${previewOrientation}-${level}`
            }
            className={
              editable
                ? "h-full min-h-0 max-h-full w-full min-w-0 max-w-full rounded-lg border-white/10 shadow-none"
                : undefined
            }
            backgroundUrl={backgroundLayerHidden ? null : backgroundUrl}
            nodes={nodes}
            selectedId={selectedNodeId}
            selectedIds={editable ? effectiveSelectedNodeIds : [selectedNodeId]}
            focusNodeId={focusNodeId}
            editable={editable}
            emptyLabel={
              backgroundLayerHidden
                ? "底图图层已隐藏"
                : level === "world"
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

        {editable && <aside className="h-full min-w-0 overflow-y-auto pl-1">
          <Inspector
            level={level}
            map={selectedMap}
            location={selectedLocation}
            room={selectedRoom}
            object={selectedObject}
            roomCount={locationRooms.length}
            objectCount={sceneInteractions.length}
            interactionCount={
              selectedAttachmentParent
                ? sceneInteractions.filter(
                    (interaction) =>
                      interaction.parentNodeId === selectedAttachmentParent.id,
                  ).length
                : sceneInteractions.filter(
                    (interaction) => !interaction.parentNodeId,
                  ).length
            }
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
              if (selectedObject) openObjectForm(selectedObject);
              else if (level === "world" && selectedLocation)
                openLocationForm(selectedLocation);
              else if (level === "location" && selectedRoom)
                openRoomForm(selectedRoom);
            }}
            onDelete={() => void deleteCurrent()}
            onAddInteraction={() =>
              openObjectForm(
                undefined,
                selectedAttachmentParent?.id ?? "",
              )
            }
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
                allowVideo
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
                onChange={(event) => {
                  const roomType = event.target.value;
                  setRoomForm({
                    ...roomForm,
                    roomType,
                    inkScriptId:
                      roomType === "vn_scene" ? roomForm.inkScriptId : "",
                  });
                }}
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
                allowVideo
              />
            </Field>
            {roomForm.roomType === "vn_scene" && (
              <Field label="关联 Ink 剧情">
                <Popover
                  open={inkStoryPickerOpen}
                  onOpenChange={(open) => {
                    setInkStoryPickerOpen(open);
                    if (open) void loadInkStories();
                  }}
                >
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={inkStoryPickerOpen}
                      className="w-full justify-between px-3 font-normal"
                    >
                      <span className="min-w-0 truncate">
                        {inkStories.find(
                          (story) => story.id === roomForm.inkScriptId,
                        )?.title ??
                          roomForm.inkScriptId ??
                          "搜索并选择 Ink 剧情"}
                      </span>
                      <ChevronsUpDown data-icon="inline-end" className="opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    className="w-[var(--radix-popover-trigger-width)] p-0"
                  >
                    <Command>
                      <CommandInput placeholder="搜索标题、Key 或 ID…" />
                      <CommandList>
                        <CommandEmpty>
                          {inkStoriesLoading
                            ? "正在加载 Ink 剧情…"
                            : "没有找到匹配的 Ink 剧情"}
                        </CommandEmpty>
                        <CommandGroup heading="Ink 剧情">
                          <CommandItem
                            value="不关联 none clear"
                            onSelect={() => {
                              setRoomForm({ ...roomForm, inkScriptId: "" });
                              setInkStoryPickerOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "opacity-0",
                                !roomForm.inkScriptId && "opacity-100",
                              )}
                            />
                            <span>不关联剧情</span>
                          </CommandItem>
                          {inkStories.map((story) => (
                            <CommandItem
                              key={story.id}
                              value={`${story.title} ${story.key} ${story.id}`}
                              onSelect={() => {
                                setRoomForm({
                                  ...roomForm,
                                  inkScriptId: story.id,
                                });
                                setInkStoryPickerOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "opacity-0",
                                  roomForm.inkScriptId === story.id &&
                                    "opacity-100",
                                )}
                              />
                              <span className="min-w-0 flex-1 truncate">
                                {story.title}
                              </span>
                              <span className="max-w-28 truncate text-[10px] text-muted-foreground">
                                {story.key}
                              </span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </Field>
            )}
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
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingObject ? "编辑场景互动" : "添加场景互动"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            {level !== "room" && (
              <div className="rounded-xl border bg-muted/30 p-3">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
                  <Field
                    label={`附着到${level === "world" ? "地点" : "房间"}（可选）`}
                  >
                    <ResourceCombobox
                      value={objectForm.parentNodeId ?? ""}
                      placeholder="不附着，作为场景独立互动"
                      options={
                        level === "world"
                          ? mapLocations.map((location) => ({
                              id: location.id,
                              label: location.displayName,
                              description: "移动地点时会一起移动",
                            }))
                          : locationRooms.map((room) => ({
                              id: room.id,
                              label: room.displayName,
                              description: "移动房间时会一起移动",
                            }))
                      }
                      onChange={(parentNodeId) =>
                        setObjectForm((current) => ({
                          ...current,
                          parentNodeId,
                          anchorMode: "attached",
                        }))
                      }
                    />
                  </Field>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={!objectForm.parentNodeId}
                    onClick={() =>
                      setObjectForm((current) => ({
                        ...current,
                        parentNodeId: "",
                        anchorMode: "scene",
                      }))
                    }
                  >
                    设为独立
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  附着互动仍有自己的图层和点击区域，但会跟随所属资源移动，并显示在它的预览卡片中。
                </p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="互动类型">
                <Select
                  value={objectForm.interactionType}
                  onChange={(event) =>
                    setObjectForm({
                      ...objectForm,
                      interactionType: event.target.value as SceneInteractionType,
                    })
                  }
                >
                  <SelectItem value="learning">学习热点</SelectItem>
                  <SelectItem value="character">角色互动</SelectItem>
                  {level === "room" && (
                    <SelectItem value="exit">房间出口</SelectItem>
                  )}
                </Select>
              </Field>
              <Field label="后台名称">
                <Input
                  value={objectForm.title}
                  onChange={(event) =>
                    setObjectForm({ ...objectForm, title: event.target.value })
                  }
                  placeholder="例如：体温计 / 校医 / 诊疗室的门"
                />
              </Field>
            </div>

            {objectForm.interactionType === "learning" && (
              <>
                <div className="grid grid-cols-[160px_minmax(0,1fr)] gap-3">
                  <Field label="资源类型">
                    <Select
                      value={objectForm.resourceType}
                      onChange={(event) =>
                        setObjectForm({
                          ...objectForm,
                          resourceType: event.target.value as LearningResourceType,
                          resourceId: "",
                        })
                      }
                    >
                      <SelectItem value="vocabulary">单词</SelectItem>
                      <SelectItem value="chunk">句块</SelectItem>
                      <SelectItem value="pattern">句型</SelectItem>
                    </Select>
                  </Field>
                  <Field label="绑定已有学习资源">
                    <ResourceCombobox
                      loading={interactionResourcesLoading}
                      value={objectForm.resourceId}
                      placeholder="搜索并选择已有资源"
                      options={
                        objectForm.resourceType === "vocabulary"
                          ? vocabularyResources.map((item) => ({
                              id: item.id,
                              label: item.word,
                              description: item.meaning,
                            }))
                          : objectForm.resourceType === "chunk"
                            ? chunkResources.map((item) => ({
                                id: item.id,
                                label: item.text,
                                description: item.meaning,
                              }))
                            : patternResources.map((item) => ({
                                id: item.id,
                                label: item.pattern,
                                description: item.meaning ?? "",
                              }))
                      }
                      onChange={(id) =>
                        bindLearningResource(
                          objectForm.resourceType as LearningResourceType,
                          id,
                        )
                      }
                    />
                  </Field>
                </div>
                {objectForm.resourceId && (
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="font-english font-medium">{objectForm.english}</p>
                    <p className="text-sm text-muted-foreground">
                      <span className="font-ipa">{objectForm.pronunciation}</span>{' '}{objectForm.translation}
                    </p>
                    {objectForm.example && (
                      <p className="mt-2 text-xs">{objectForm.example}</p>
                    )}
                  </div>
                )}
                <Field label="学习提示">
                  <Textarea
                    value={objectForm.prompt}
                    onChange={(event) =>
                      setObjectForm({ ...objectForm, prompt: event.target.value })
                    }
                    placeholder="例如：点击物品后听发音并跟读。"
                  />
                </Field>
              </>
            )}

            {objectForm.interactionType === "character" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="绑定角色">
                    <ResourceCombobox
                      loading={interactionResourcesLoading}
                      value={objectForm.characterId}
                      placeholder="搜索并选择角色"
                      options={characters.map((character) => ({
                        id: character.id,
                        label: character.displayName,
                        description: character.role,
                      }))}
                      onChange={(id) => {
                        const character = characters.find((item) => item.id === id);
                        setObjectForm({
                          ...objectForm,
                          characterId: id,
                          title: character?.displayName ?? objectForm.title,
                          imageUrl:
                            character?.spriteBaseUrl ??
                            character?.avatarUrl ??
                            objectForm.imageUrl,
                        });
                      }}
                    />
                  </Field>
                  <Field label="互动方式">
                    <Select
                      value={objectForm.characterMode}
                      onChange={(event) =>
                        setObjectForm({
                          ...objectForm,
                          characterMode: event.target.value as "ink" | "ai",
                        })
                      }
                    >
                      <SelectItem value="ai">AI 自由对话</SelectItem>
                      <SelectItem value="ink">固定 Ink 剧情</SelectItem>
                    </Select>
                  </Field>
                </div>
                {objectForm.characterMode === "ink" && (
                  <Field label="Ink 剧情">
                    <ResourceCombobox
                      loading={inkStoriesLoading}
                      value={objectForm.inkScriptId}
                      placeholder="搜索并选择 Ink 剧情"
                      options={inkStories.map((story) => ({
                        id: story.id,
                        label: story.title,
                        description: story.key,
                      }))}
                      onOpen={() => void loadInkStories()}
                      onChange={(id) =>
                        setObjectForm({ ...objectForm, inkScriptId: id })
                      }
                    />
                  </Field>
                )}
                <Field label="角色开场白">
                  <Input
                    value={objectForm.openingLine}
                    onChange={(event) =>
                      setObjectForm({
                        ...objectForm,
                        openingLine: event.target.value,
                      })
                    }
                    placeholder="Hi! How can I help you today?"
                  />
                </Field>
                <Field label="AI 场景引导">
                  <Textarea
                    value={objectForm.prompt}
                    onChange={(event) =>
                      setObjectForm({ ...objectForm, prompt: event.target.value })
                    }
                    placeholder="例如：你是校医，引导学习者描述症状并给出简单建议。"
                  />
                </Field>
              </>
            )}

            {objectForm.interactionType === "exit" && (
              <Field label="目标房间">
                <ResourceCombobox
                  value={objectForm.targetRoomId}
                  placeholder="搜索并选择目标房间"
                  options={locationRooms
                    .filter((room) => room.id !== selectedRoom?.id)
                    .map((room) => ({
                      id: room.id,
                      label: room.displayName,
                      description: room.roomType,
                    }))}
                  onChange={(id) => {
                    const target = locationRooms.find((room) => room.id === id);
                    setObjectForm({
                      ...objectForm,
                      targetRoomId: id,
                      title: objectForm.title || `前往${target?.displayName ?? ""}`,
                    });
                  }}
                />
              </Field>
            )}

            <div className="rounded-lg border bg-muted/20 p-3">
              <Field label="元素素材">
                <ToggleGroup
                  type="single"
                  value={objectForm.mediaType ?? "image"}
                  onValueChange={(value) => {
                    if (!value) return;
                    setObjectForm({
                      ...objectForm,
                      mediaType: value as ExplorationMediaType,
                      imageUrl: "",
                      spritesheetUrl: "",
                      animationName: "",
                      animationNames: [],
                    });
                  }}
                  className="grid grid-cols-3"
                  aria-label="元素素材类型"
                >
                  <ToggleGroupItem value="image">静态图片</ToggleGroupItem>
                  <ToggleGroupItem value="video">循环视频</ToggleGroupItem>
                  <ToggleGroupItem value="spritesheet">
                    帧动画
                  </ToggleGroupItem>
                </ToggleGroup>
              </Field>

              <div className="mt-3">
                {(objectForm.mediaType ?? "image") === "image" && (
                  <ImageUploadField
                    value={objectForm.imageUrl}
                    onChange={(url) =>
                      setObjectForm({ ...objectForm, imageUrl: url })
                    }
                    previewSize="md"
                    group="library"
                    placeholder="上传透明 PNG 或 WebP"
                  />
                )}
                {objectForm.mediaType === "video" && (
                  <ImageUploadField
                    value={objectForm.imageUrl}
                    onChange={(url) =>
                      setObjectForm({ ...objectForm, imageUrl: url })
                    }
                    previewSize="md"
                    group="library"
                    allowVideo
                    videoOnly
                    placeholder="上传 MP4 或 WebM"
                  />
                )}
                {objectForm.mediaType === "spritesheet" && (
                  <SpritesheetZipUploadField
                    value={
                      objectForm.spritesheetUrl
                        ? {
                            imageUrl: objectForm.imageUrl,
                            spritesheetUrl: objectForm.spritesheetUrl,
                            animationNames:
                              objectForm.animationNames ?? [],
                          }
                        : null
                    }
                    onChange={(value: SpritesheetImportValue | null) =>
                      setObjectForm({
                        ...objectForm,
                        imageUrl: value?.imageUrl ?? "",
                        spritesheetUrl: value?.spritesheetUrl ?? "",
                        animationNames: value?.animationNames ?? [],
                        animationName:
                          value?.animationNames[0] ?? "",
                      })
                    }
                    disabled={saving}
                  />
                )}
              </div>

              {objectForm.mediaType === "spritesheet" &&
                !!objectForm.animationNames?.length && (
                  <div className="mt-3 grid grid-cols-[minmax(0,1fr)_110px] gap-3">
                    <Field label="默认动画">
                      <Select
                        value={
                          objectForm.animationName ||
                          objectForm.animationNames[0]
                        }
                        onChange={(event) =>
                          setObjectForm({
                            ...objectForm,
                            animationName: event.target.value,
                          })
                        }
                      >
                        {objectForm.animationNames.map((name) => (
                          <SelectItem key={name} value={name}>
                            {name}
                          </SelectItem>
                        ))}
                      </Select>
                    </Field>
                    <Field label="播放帧率">
                      <Input
                        type="number"
                        min={1}
                        max={60}
                        value={objectForm.animationFps ?? 12}
                        onChange={(event) =>
                          setObjectForm({
                            ...objectForm,
                            animationFps: Math.max(
                              1,
                              Math.min(60, Number(event.target.value) || 12),
                            ),
                          })
                        }
                      />
                    </Field>
                    <label className="col-span-2 flex items-center justify-between rounded-md border bg-background p-2.5 text-sm">
                      循环播放
                      <Switch
                        checked={objectForm.animationLoop ?? true}
                        onCheckedChange={(checked) =>
                          setObjectForm({
                            ...objectForm,
                            animationLoop: checked,
                          })
                        }
                      />
                    </label>
                  </div>
                )}
            </div>

            <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
              <div className="flex size-24 items-center justify-center rounded-lg border bg-muted/20 text-center text-[11px] text-muted-foreground">
                {objectForm.mediaType === "video"
                  ? "视频纹理"
                  : objectForm.mediaType === "spritesheet"
                    ? "帧动画"
                    : "静态素材"}
              </div>
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
            </div>
            {objectForm.interactionType === "learning" && (
              <label className="flex items-center justify-between rounded-lg border p-3 text-sm">
                作为当前场景的必学热点
                <Switch
                  checked={objectForm.required}
                  onCheckedChange={(checked) =>
                    setObjectForm({ ...objectForm, required: checked })
                  }
                />
              </label>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setObjectDialog(false)}>
              取消
            </Button>
            <Button
              disabled={saving || !objectForm.title.trim()}
              onClick={() => void saveObject()}
            >
              保存互动
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!previewId}
        onOpenChange={(open) => !open && setPreviewId("")}
      >
        <DialogContent
          className={cn(
            "max-h-[min(860px,92vh)] overflow-hidden border-0 bg-[#f7f3e9] p-0 shadow-2xl dark:bg-[#161b22]",
            previewObject?.interactionType === "character" &&
              previewObject.characterMode === "ink"
              ? "sm:max-w-4xl"
              : previewObject?.interactionType === "character"
                ? "sm:max-w-xl"
                : "sm:max-w-lg",
          )}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>玩家探索预览</DialogTitle>
          </DialogHeader>
          {previewLocation && !previewObject && (
            <PreviewPlace
              image={previewLocation.icon}
              eyebrow="剧情地点"
              title={previewLocation.displayName}
              description={previewLocation.description}
              stats={`${rooms.filter((item) => item.locationId === previewLocation.id).length} 个可进入房间`}
              interactions={previewPlaceInteractions}
              onInteraction={openNode}
              action="进入地点"
              onAction={() => {
                setPreviewId("");
                enterLocationPreview(previewLocation.id);
              }}
            />
          )}
          {previewRoom && !previewObject && (
            <PreviewPlace
              image={previewRoom.icon}
              eyebrow={previewRoom.isEntrance ? "入口房间" : "探索房间"}
              title={previewRoom.displayName}
              description={previewRoom.description}
              stats={`${getExplorationObjects(selectedMap, previewRoom.id).length} 个可发现物品`}
              interactions={previewPlaceInteractions}
              onInteraction={openNode}
              action="进入房间"
              onAction={() => {
                setPreviewId("");
                enterRoom(previewRoom.id);
              }}
            />
          )}
          {previewObject?.parentNodeId && (previewLocation || previewRoom) && (
            <div className="flex items-center gap-3 border-b border-black/5 bg-white/55 px-4 py-3 backdrop-blur dark:border-white/10 dark:bg-white/5">
              <Button
                size="icon-sm"
                variant="ghost"
                className="rounded-full"
                onClick={() => setPreviewId(previewObject.parentNodeId ?? "")}
                aria-label="返回地点卡片"
              >
                <ArrowLeft />
              </Button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {previewLocation?.displayName ?? previewRoom?.displayName}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  正在体验附着互动
                </p>
              </div>
              <Badge variant="outline" className="rounded-full bg-background/70">
                {previewPlaceInteractions.length} 个发现
              </Badge>
            </div>
          )}
          {previewObject?.interactionType === "character" &&
            previewObject.characterMode === "ink" &&
            previewStory && (
              <div className="h-[min(720px,82vh)]">
                <VnStoryPreview
                  inkSource={previewStory.inkSource ?? undefined}
                  inkJson={previewStory.inkJson}
                  defaultBackgroundUrl={backgroundUrl ?? undefined}
                  previewLayout="portrait"
                  className="h-full"
                />
              </div>
            )}
          {previewObject?.interactionType === "character" &&
            previewObject.characterMode === "ink" &&
            !previewStory && (
              <div className="flex min-h-64 flex-col items-center justify-center gap-3 p-8 text-center">
                {previewObject.inkScriptId ? (
                  <>
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      正在加载 Ink 剧情…
                    </p>
                  </>
                ) : (
                  <>
                    <BookOpen className="size-8 text-muted-foreground" />
                    <p className="font-medium">该角色尚未绑定 Ink 剧情</p>
                  </>
                )}
              </div>
            )}
          {previewObject?.interactionType === "character" &&
            previewObject.characterMode !== "ink" && (
              <div className="flex h-[min(680px,78vh)] flex-col">
                <div className="flex items-center gap-3 border-b border-black/5 bg-gradient-to-r from-emerald-100/80 to-cyan-100/60 p-4 dark:border-white/10 dark:from-emerald-950/60 dark:to-cyan-950/40">
                  <div className="flex size-12 items-center justify-center overflow-hidden rounded-2xl border-2 border-white bg-muted shadow-md dark:border-white/20">
                    {previewObject.imageUrl ? (
                      <ExplorationMediaPreview
                        object={previewObject}
                        className="size-full object-cover"
                      />
                    ) : (
                      <Bot className="size-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-lg font-bold">{previewObject.title}</p>
                    <p className="text-xs text-muted-foreground">
                      AI 自由英语对话 · 不怕说错，像真实见面一样聊
                    </p>
                  </div>
                </div>
                <ScrollArea className="min-h-0 flex-1 p-4">
                  <div className="flex flex-col gap-3 pr-3">
                    {!roleplayHistory.length && (
                      <p className="py-12 text-center text-sm text-muted-foreground">
                        输入一句英语，开始自由对话
                      </p>
                    )}
                    {roleplayHistory.map((turn, index) => (
                      <div
                        key={`${turn.speaker}-${index}`}
                        className={cn(
                          "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-6",
                          turn.speaker === "user"
                            ? "ml-auto rounded-br-md bg-emerald-600 text-white shadow-sm"
                            : "rounded-bl-md bg-white shadow-sm dark:bg-white/10",
                        )}
                      >
                        {turn.text}
                      </div>
                    ))}
                    {roleplayLoading && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" />
                        角色正在回应…
                      </div>
                    )}
                  </div>
                </ScrollArea>
                {roleplayCoach && (
                  <p className="border-t bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
                    {roleplayCoach}
                  </p>
                )}
                <div className="flex gap-2 border-t border-black/5 bg-white/60 p-3 backdrop-blur dark:border-white/10 dark:bg-white/5">
                  <Input
                    className="h-11 rounded-xl bg-background"
                    value={roleplayInput}
                    onChange={(event) => setRoleplayInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void submitRoleplayTurn();
                      }
                    }}
                    placeholder="用英语回应角色…"
                    disabled={roleplayLoading}
                  />
                  <Button
                    size="icon"
                    className="size-11 rounded-xl bg-emerald-600 hover:bg-emerald-700"
                    disabled={!roleplayInput.trim() || roleplayLoading}
                    onClick={() => void submitRoleplayTurn()}
                    aria-label="发送英语回复"
                  >
                    <Send />
                  </Button>
                </div>
              </div>
            )}
          {previewObject &&
            (previewObject.interactionType ?? "learning") === "learning" && (
            <div className="relative overflow-y-auto">
              <div className="grid gap-4 p-4 sm:grid-cols-[150px_minmax(0,1fr)]">
                <div className="relative h-36 overflow-hidden rounded-[1.5rem] border border-black/5 bg-gradient-to-br from-amber-100 via-orange-50 to-rose-100 shadow-sm dark:from-amber-950/50 dark:via-slate-900 dark:to-rose-950/40 sm:h-full sm:min-h-48">
                  {previewObject.imageUrl ? (
                    <ExplorationMediaPreview
                      object={previewObject}
                      className="size-full object-contain p-5 drop-shadow-lg"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center">
                      <Box className="size-12 text-amber-700/40 dark:text-amber-200/40" />
                    </div>
                  )}
                  <Badge className="absolute left-3 top-3 rounded-full bg-white/85 text-foreground shadow-sm backdrop-blur hover:bg-white/85 dark:bg-black/50">
                    {OBJECT_KIND_LABELS[previewObject.kind]}
                  </Badge>
                </div>
                <div className="flex min-w-0 flex-col justify-center rounded-[1.5rem] bg-white/70 p-5 shadow-sm dark:bg-white/5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-700 dark:text-amber-300">
                      Tap · listen · remember
                    </p>
                    <h2 className="mt-2 font-english text-3xl font-black tracking-tight">
                      {previewObject.english || previewObject.title}
                    </h2>
                    <p className="mt-1 font-ipa text-sm text-muted-foreground">
                      {previewObject.pronunciation}
                    </p>
                  </div>
                  <Button
                    aria-label="播放英文发音"
                    size="icon"
                    className="size-11 shrink-0 rounded-full bg-amber-500 text-white shadow-lg shadow-amber-500/20 hover:bg-amber-600"
                    onClick={() =>
                      pronounce(previewObject.english || previewObject.title)
                    }
                  >
                    <Volume2 />
                  </Button>
                </div>
                <p className="mt-4 text-lg font-semibold">
                  {previewObject.translation}
                </p>
                {previewObject.example && (
                  <button
                    type="button"
                    className="mt-4 rounded-2xl border border-amber-900/10 bg-amber-50/80 p-4 text-left text-sm leading-6 transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-amber-100/10 dark:bg-amber-950/30"
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
                  <p className="mt-4 flex items-start gap-2 text-sm text-muted-foreground">
                    <MessageCircle className="mt-0.5 shrink-0" />
                    {previewObject.prompt}
                  </p>
                )}
                <Button
                  className="mt-5 h-11 rounded-xl"
                  onClick={() => {
                    setDiscovered((items) =>
                      new Set([...items, previewObject.id]),
                    );
                    setPreviewId(previewObject.parentNodeId ?? "");
                    toast.success(`已发现：${previewObject.english || previewObject.title}`);
                  }}
                >
                  <Languages data-icon="inline-start" />
                  学会了，继续探索
                </Button>
                </div>
              </div>
            </div>
          )}
          {previewObject?.interactionType === "exit" && (
            <div className="p-6 text-center">
              <DoorOpen className="mx-auto size-10 text-muted-foreground" />
              <p className="mt-3 font-medium">目标房间不可进入</p>
              <p className="mt-1 text-sm text-muted-foreground">
                请检查出口绑定、隐藏或禁用状态。
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ResourceCombobox({
  value,
  options,
  placeholder,
  loading = false,
  onChange,
  onOpen,
}: {
  value: string;
  options: Array<{ id: string; label: string; description?: string | null }>;
  placeholder: string;
  loading?: boolean;
  onChange: (id: string) => void;
  onOpen?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.id === value);

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) onOpen?.();
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-9 w-full justify-between px-3 font-normal"
        >
          <span className="min-w-0 truncate">
            {selected?.label || placeholder}
          </span>
          {loading ? (
            <Loader2 className="size-4 shrink-0 animate-spin opacity-60" />
          ) : (
            <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command>
          <CommandInput placeholder="输入关键词搜索…" />
          <CommandList>
            <CommandEmpty>
              {loading ? "正在加载资源…" : "没有找到匹配资源"}
            </CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.id}
                  value={`${option.label} ${option.description ?? ""} ${option.id}`}
                  onSelect={() => {
                    onChange(option.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "size-4 shrink-0",
                      value === option.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{option.label}</span>
                    {option.description && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {option.description}
                      </span>
                    )}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
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
  onRename,
  onToggleLock,
  onToggleVisibility,
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
  onRename: (id: string, name: string) => void;
  onToggleLock: (id: string, locked: boolean) => void;
  onToggleVisibility: (id: string, hidden: boolean) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onAssign: () => void;
  onGroup: () => void;
  onUngroup: () => void;
}) {
  const [editingLayerId, setEditingLayerId] = useState("");
  const [layerNameDraft, setLayerNameDraft] = useState("");
  const activeLayer = layers.find((layer) => layer.id === activeLayerId);
  const activeIndex = layers.findIndex((layer) => layer.id === activeLayerId);
  const isCustomLayer = !activeLayer?.system;
  const activeLayerLocked = !!activeLayer?.locked;
  const finishRename = (layer: ExplorationLayer) => {
    const nextName = layerNameDraft.trim();
    if (nextName && nextName !== layer.name) onRename(layer.id, nextName);
    setEditingLayerId("");
    setLayerNameDraft("");
  };
  return (
    <Card className="w-full min-w-0 shrink-0 overflow-hidden border border-border/60">
      <CardHeader className="flex flex-row items-center justify-between p-2 pb-1">
        <div className="flex items-center gap-1.5">
          <Layers3 className="size-3.5" />
          <CardTitle className="text-xs">图层</CardTitle>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon-sm"
            variant="ghost"
            className="size-7"
            aria-label="新增图层"
            onClick={onAdd}
          >
            <Plus />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            className="size-7"
            aria-label="删除当前图层"
            title="删除当前图层"
            disabled={!isCustomLayer || activeLayerLocked}
            onClick={onDelete}
          >
            <Trash2 />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-1.5 p-2 pt-0">
        <ScrollArea className="max-h-32">
          <div className="flex flex-col gap-0.5 pr-1">
            {[...layers].reverse().map((layer) => {
              const count =
                layer.id === BACKGROUND_LAYER_ID
                  ? hasBackground
                    ? 1
                    : 0
                  : nodes.filter((node) => node.layerId === layer.id).length;
              return (
                <div
                  key={layer.id}
                  className={cn(
                    "group flex h-8 items-center gap-0.5 rounded-md px-1 transition-colors",
                    layer.id === activeLayerId
                      ? "bg-secondary text-secondary-foreground"
                      : "hover:bg-muted",
                    layer.hidden && "text-muted-foreground",
                  )}
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-1.5 px-1 text-xs"
                    onClick={() => onSelectLayer(layer.id)}
                  >
                    <Layers3 className="size-3.5 shrink-0" />
                    {editingLayerId === layer.id ? (
                      <Input
                        autoFocus
                        value={layerNameDraft}
                        className="h-6 min-w-0 px-1.5 text-xs"
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) =>
                          setLayerNameDraft(event.target.value)
                        }
                        onBlur={() => finishRename(layer)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.currentTarget.blur();
                          }
                          if (event.key === "Escape") {
                            setEditingLayerId("");
                            setLayerNameDraft("");
                          }
                        }}
                        aria-label="图层名称"
                      />
                    ) : (
                      <span className="min-w-0 flex-1 truncate text-left">
                        {layer.name}
                      </span>
                    )}
                    <Badge variant="outline" className="h-5 px-1.5 text-[9px]">
                      {count}
                    </Badge>
                  </button>
                  {layer.system !== "background" && (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="size-6 shrink-0"
                      aria-label={`重命名${layer.name}`}
                      title="重命名"
                      onClick={() => {
                        setEditingLayerId(layer.id);
                        setLayerNameDraft(layer.name);
                      }}
                    >
                      <Pencil className="size-3" />
                    </Button>
                  )}
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="size-6 shrink-0"
                    disabled={layer.system === "background"}
                    aria-label={
                      layer.locked ? `解锁${layer.name}` : `锁定${layer.name}`
                    }
                    title={layer.locked ? "解锁图层" : "锁定图层"}
                    onClick={() => onToggleLock(layer.id, !layer.locked)}
                  >
                    {layer.locked ? (
                      <LockKeyhole className="size-3" />
                    ) : (
                      <LockOpen className="size-3" />
                    )}
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="size-6 shrink-0"
                    aria-label={
                      layer.hidden ? `显示${layer.name}` : `隐藏${layer.name}`
                    }
                    title={layer.hidden ? "显示图层" : "隐藏图层"}
                    onClick={() =>
                      onToggleVisibility(layer.id, !layer.hidden)
                    }
                  >
                    {layer.hidden ? (
                      <EyeOff className="size-3" />
                    ) : (
                      <Eye className="size-3" />
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        </ScrollArea>
        <Separator />
        <div className="grid grid-cols-2 gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-[11px]"
            disabled={
              !isCustomLayer ||
              activeLayerLocked ||
              activeIndex >= layers.length - 1
            }
            onClick={onMoveUp}
          >
            <ChevronUp data-icon="inline-start" />
            上移
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-[11px]"
            disabled={!isCustomLayer || activeLayerLocked || activeIndex <= 2}
            onClick={onMoveDown}
          >
            <ChevronDown data-icon="inline-start" />
            下移
          </Button>
        </div>
        <Button
          size="sm"
          variant="secondary"
          className="h-7 px-2 text-[11px]"
          disabled={
            !selectedCount ||
            activeLayerLocked ||
            activeLayerId === BACKGROUND_LAYER_ID
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
            className="h-7 px-2 text-[11px]"
            disabled={selectedCount < 2 || activeLayerLocked}
            onClick={onGroup}
          >
            <Group data-icon="inline-start" />
            组合
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-[11px]"
            disabled={!selectedCount || activeLayerLocked}
            onClick={onUngroup}
          >
            <Ungroup data-icon="inline-start" />
            取消组合
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function InteractionPropertyPanel({
  count,
  ownerName,
  onAdd,
}: {
  count: number;
  ownerName?: string;
  onAdd: () => void;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/25 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Sparkles className="size-3.5 text-amber-500" />
            <p className="text-xs font-semibold">场景互动</p>
            <Badge variant="outline" className="h-5 rounded-full px-1.5 text-[10px]">
              {count}
            </Badge>
          </div>
          <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
            {ownerName
              ? `新互动默认附着到“${ownerName}”`
              : "新互动默认放在当前场景"}
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          className="h-7 shrink-0 rounded-lg px-2.5 text-[11px]"
          onClick={onAdd}
        >
          <Plus data-icon="inline-start" />
          添加
        </Button>
      </div>
    </div>
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
  interactionCount,
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
  onAddInteraction,
}: {
  level: StudioLevel;
  map: GameMapData | null;
  location: GameLocationData | null;
  room: GameRoomData | null;
  object: ExplorationObject | null;
  roomCount: number;
  objectCount: number;
  interactionCount: number;
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
  onAddInteraction: () => void;
}) {
  if (object) {
    const interactionLabel =
      object.interactionType === "character"
        ? object.characterMode === "ink"
          ? "角色 · Ink 剧情"
          : "角色 · AI 对话"
        : object.interactionType === "exit"
          ? "房间出口"
          : object.resourceType === "chunk"
            ? "句块热点"
            : object.resourceType === "pattern"
              ? "句型热点"
              : "单词热点";
    return (
      <Card className="overflow-hidden">
        {object.imageUrl && (
          <div className="h-28 bg-muted">
            <ExplorationMediaPreview
              object={object}
              className="size-full object-contain p-3"
            />
          </div>
        )}
        <CardHeader className="gap-2 p-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary">{interactionLabel}</Badge>
            {object.parentNodeId && <Badge variant="outline">附着互动</Badge>}
            {object.required && <Badge>必学</Badge>}
          </div>
          <CardTitle className="text-sm">{object.title}</CardTitle>
          {object.prompt && (
            <CardDescription className="line-clamp-3 text-xs">
              {object.prompt}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-2 p-3 pt-0">
          {object.interactionType === "learning" && (
            <div className="rounded-md border bg-muted/30 p-2">
              <p className="font-english font-medium">{object.english || "未绑定资源"}</p>
              <p className="text-xs text-muted-foreground">
                {object.pronunciation && <span className="font-ipa">{object.pronunciation}</span>}
                {object.pronunciation && object.translation ? ' · ' : ''}
                {object.translation}
              </p>
            </div>
          )}
          {object.interactionType === "character" && (
            <p className="text-xs text-muted-foreground">
              {object.openingLine || "尚未设置角色开场白"}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" variant="outline" onClick={onEdit}>
              <Edit3 data-icon="inline-start" />
              编辑
            </Button>
            <Button size="sm" variant="ghost" onClick={onDelete}>
              <Trash2 data-icon="inline-start" />
              删除
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (level === "room") {
    return (
      <Card className="overflow-hidden">
        {room?.icon && (
          <div className="h-28 bg-muted">
            <MediaUrlPreview
              url={room.icon}
              className="size-full object-contain p-3"
            />
          </div>
        )}
        <CardHeader className="gap-2 p-3">
          <Badge variant="secondary" className="w-fit">
            当前房间
          </Badge>
          <CardTitle className="text-sm">{room?.displayName}</CardTitle>
          <CardDescription className="text-xs">
            {objectCount} 个互动热点。可添加角色、学习资源或通往其他房间的出口。
          </CardDescription>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <InteractionPropertyPanel
            count={interactionCount}
            onAdd={onAddInteraction}
          />
        </CardContent>
      </Card>
    );
  }

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
        <CardContent>
          <InteractionPropertyPanel
            count={interactionCount}
            onAdd={onAddInteraction}
          />
        </CardContent>
      </Card>
    );
  }
  if (level === "location" && !room) {
    return (
      <Card>
        <CardHeader className="p-3">
          <Badge variant="secondary" className="w-fit">
            地点场景
          </Badge>
          <CardTitle className="text-sm">{location?.displayName}</CardTitle>
          <CardDescription className="text-xs">
            选择一个房间编辑属性，或在地点场景中添加独立互动。
          </CardDescription>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <InteractionPropertyPanel
            count={interactionCount}
            onAdd={onAddInteraction}
          />
        </CardContent>
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
          <MediaUrlPreview
            url={image}
            className="size-full object-contain p-3"
          />
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
            <InteractionPropertyPanel
              count={interactionCount}
              ownerName={location?.displayName}
              onAdd={onAddInteraction}
            />
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
          <>
            <p className="text-xs text-muted-foreground">
              {objectCount} 个场景互动
            </p>
            <InteractionPropertyPanel
              count={interactionCount}
              ownerName={room?.displayName}
              onAdd={onAddInteraction}
            />
          </>
        )}
        <Button onClick={onEnter}>
          <BookOpen data-icon="inline-start" />
          进入下一层编辑
        </Button>
        <Button variant="outline" onClick={onEdit}>
          <Edit3 data-icon="inline-start" />
          编辑属性
        </Button>
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
  interactions,
  onInteraction,
  action,
  onAction,
}: {
  image?: string | null;
  eyebrow: string;
  title: string;
  description?: string | null;
  stats: string;
  interactions: ExplorationObject[];
  onInteraction: (id: string) => void;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className="max-h-[min(820px,90vh)] overflow-y-auto">
      <div className="relative h-60 overflow-hidden bg-gradient-to-br from-sky-200 via-amber-100 to-orange-200 dark:from-sky-950 dark:via-slate-900 dark:to-orange-950">
        <div className="absolute -left-12 -top-16 size-44 rounded-full bg-white/35 blur-2xl" />
        <div className="absolute -bottom-20 -right-10 size-52 rounded-full bg-orange-400/25 blur-3xl" />
        {image ? (
          <MediaUrlPreview
            url={image}
            className="relative z-10 size-full object-contain px-8 pb-5 pt-10 drop-shadow-2xl"
          />
        ) : (
          <div className="relative z-10 flex size-full items-center justify-center">
            <MapPin className="size-16 text-sky-900/25 dark:text-sky-100/25" />
          </div>
        )}
        <Badge className="absolute left-4 top-4 z-20 rounded-full border-white/40 bg-white/75 px-3 text-foreground shadow-sm backdrop-blur hover:bg-white/75 dark:bg-black/40">
          <Compass className="mr-1 size-3.5" />
          {eyebrow}
        </Badge>
        <div className="absolute bottom-3 right-4 z-20 rounded-full bg-black/55 px-3 py-1 text-[11px] font-medium text-white backdrop-blur">
          {stats}
        </div>
      </div>
      <div className="flex flex-col gap-5 p-5 sm:p-6">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-orange-600 dark:text-orange-300">
            Explore · Speak · Remember
          </p>
          <h2 className="mt-1 text-3xl font-black tracking-tight">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {description || "这里的故事还没有写下。"}
          </p>
        </div>

        <section className="rounded-[1.5rem] border border-black/5 bg-white/70 p-3 shadow-sm dark:border-white/10 dark:bg-white/5">
          <div className="flex items-center justify-between px-1 pb-3">
            <div>
              <h3 className="text-sm font-bold">在这里可以发现</h3>
              <p className="text-[11px] text-muted-foreground">
                先学一点，或者直接进入场景
              </p>
            </div>
            <Badge variant="secondary" className="rounded-full">
              {interactions.length}
            </Badge>
          </div>
          {interactions.length ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {interactions.map((interaction) => {
                const isCharacter = interaction.interactionType === "character";
                const isExit = interaction.interactionType === "exit";
                return (
                  <button
                    key={interaction.id}
                    type="button"
                    className="group flex min-w-0 items-center gap-3 rounded-2xl border border-black/5 bg-[#fffdf8] p-2.5 text-left transition-all hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-md dark:border-white/10 dark:bg-white/5 dark:hover:border-orange-500/50"
                    onClick={() => onInteraction(interaction.id)}
                  >
                    <div
                      className={cn(
                        "flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl",
                        isCharacter
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                          : isExit
                            ? "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300"
                            : "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
                      )}
                    >
                      {interaction.imageUrl ? (
                        <ExplorationMediaPreview
                          object={interaction}
                          className="size-full object-contain p-1"
                        />
                      ) : isCharacter ? (
                        <Bot className="size-5" />
                      ) : isExit ? (
                        <DoorOpen className="size-5" />
                      ) : (
                        <GraduationCap className="size-5" />
                      )}
                    </div>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">
                        {interaction.english || interaction.title}
                      </span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {isCharacter
                          ? interaction.characterMode === "ink"
                            ? "开始剧情"
                            : "自由对话"
                          : isExit
                            ? "前往其他房间"
                            : interaction.translation || "点击学习"}
                      </span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed p-4 text-center text-xs text-muted-foreground">
              这里暂时没有额外发现，可以直接进入继续探索。
            </div>
          )}
        </section>

        <Button
          className="h-12 rounded-2xl bg-slate-950 text-base font-bold text-white shadow-lg shadow-slate-950/15 hover:bg-slate-800 dark:bg-orange-500 dark:text-slate-950 dark:hover:bg-orange-400"
          onClick={onAction}
        >
          <DoorOpen data-icon="inline-start" />
          {action}
          <ChevronRight data-icon="inline-end" />
        </Button>
      </div>
    </div>
  );
}
