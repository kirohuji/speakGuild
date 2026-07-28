import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Application, extend, useTick } from "@pixi/react";
import {
  Assets,
  Container,
  ColorMatrixFilter,
  Graphics,
  Rectangle,
  Sprite,
  Text as PixiText,
  Texture,
  type FederatedPointerEvent,
  type Graphics as PixiGraphics,
} from "pixi.js";
import { LocateFixed, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import type {
  ResourceMask,
  ResourceMaskPoint,
  LocationVisualStyle,
} from "./exploration-map-model";

extend({ Container, Graphics, Sprite });

export type ExplorationNodeKind = "location" | "room" | "object";

export type ExplorationNode = {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  kind?: ExplorationNodeKind;
  required?: boolean;
  disabled?: boolean;
  hidden?: boolean;
  mask?: ResourceMask;
  occlusionMask?: ResourceMask;
  visualStyle?: LocationVisualStyle;
  layerId?: string;
  layerOrder?: number;
  groupId?: string;
};

interface ExplorationPixiCanvasProps {
  className?: string;
  backgroundUrl?: string | null;
  nodes: ExplorationNode[];
  selectedId?: string;
  selectedIds?: string[];
  focusNodeId?: string;
  editable: boolean;
  emptyLabel: string;
  worldWidth?: number;
  worldHeight?: number;
  timeOfDay?: "day" | "golden" | "night";
  nodeBreathing?: boolean;
  mobilePreview?: boolean;
  previewOrientation?: "portrait" | "landscape";
  maskEditingId?: string;
  maskBrushRadius?: number;
  maskRestoring?: boolean;
  showMaskOverlay?: boolean;
  maskKind?: "transparency" | "occlusion";
  onSelect: (id: string, additive?: boolean) => void;
  onOpen: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onMaskPoint?: (id: string, point: ResourceMaskPoint) => void;
  onMaskEnd?: () => void;
}

type Camera = { x: number; y: number; zoom: number };
type NodeRefRegistry = Map<string, Container>;

const assetReferenceCounts = new Map<string, number>();

function retainAsset(url: string) {
  assetReferenceCounts.set(url, (assetReferenceCounts.get(url) ?? 0) + 1);
}

function releaseAsset(url: string) {
  const nextCount = Math.max(0, (assetReferenceCounts.get(url) ?? 1) - 1);
  if (nextCount) {
    assetReferenceCounts.set(url, nextCount);
    return;
  }
  assetReferenceCounts.delete(url);
  queueMicrotask(() => {
    if (!assetReferenceCounts.has(url)) {
      void Assets.unload(url).catch(() => undefined);
    }
  });
}

function isVideoSource(url?: string | null) {
  return (
    !!url &&
    (/\.(mp4|webm|ogg|mov|m4v)(?:[?#]|$)/i.test(url) ||
      /[#&?]media=video(?:&|$)/i.test(url))
  );
}

function constrainCamera(
  camera: Camera,
  options: {
    baseScale: number;
    viewportWidth: number;
    viewportHeight: number;
    worldWidth: number;
    worldHeight: number;
    coverViewport: boolean;
  },
): Camera {
  const minimumZoom = options.coverViewport ? 1 : 0.72;
  const zoom = Math.max(minimumZoom, Math.min(3.2, camera.zoom));
  if (!options.coverViewport) return { ...camera, zoom };
  const scaledWidth = options.worldWidth * options.baseScale * zoom;
  const scaledHeight = options.worldHeight * options.baseScale * zoom;
  const limitX = Math.max(0, (scaledWidth - options.viewportWidth) / 2);
  const limitY = Math.max(0, (scaledHeight - options.viewportHeight) / 2);
  return {
    zoom,
    x: Math.max(-limitX, Math.min(limitX, camera.x)),
    y: Math.max(-limitY, Math.min(limitY, camera.y)),
  };
}

const MASK_BRUSH_CURSOR =
  'url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2232%22 height=%2232%22 viewBox=%220 0 32 32%22%3E%3Ccircle cx=%2216%22 cy=%2216%22 r=%2211%22 fill=%22none%22 stroke=%22%23ef4444%22 stroke-width=%222%22/%3E%3Cpath d=%22M16 3v5M16 24v5M3 16h5M24 16h5%22 stroke=%22%23fff%22 stroke-width=%222%22/%3E%3C/svg%3E") 16 16, crosshair';
const MASK_RESTORE_CURSOR =
  'url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2232%22 height=%2232%22 viewBox=%220 0 32 32%22%3E%3Ccircle cx=%2216%22 cy=%2216%22 r=%2211%22 fill=%22none%22 stroke=%22%2322c55e%22 stroke-width=%222%22/%3E%3Cpath d=%22M16 3v5M16 24v5M3 16h5M24 16h5%22 stroke=%22%23fff%22 stroke-width=%222%22/%3E%3C/svg%3E") 16 16, crosshair';

export function ExplorationPixiCanvas({
  worldWidth: configuredWorldWidth = 1600,
  worldHeight: configuredWorldHeight = 900,
  ...props
}: ExplorationPixiCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 960, height: 620 });
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, zoom: 1 });
  const worldWidth = configuredWorldWidth;
  const worldHeight = configuredWorldHeight;
  const renderedNodes = props.nodes;

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const update = () => {
      const rect = host.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      setSize({
        width: Math.max(1, Math.round(rect.width)),
        height: Math.max(1, Math.round(rect.height)),
      });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(host);

    // Tab switching changes both the grid and the phone frame in one commit.
    // Measure again after the browser has completed those layout passes.
    const firstFrame = window.requestAnimationFrame(() => {
      update();
      secondFrame = window.requestAnimationFrame(update);
    });
    let secondFrame = 0;

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
  }, [props.className, props.mobilePreview, props.previewOrientation]);

  const fitScale = props.mobilePreview
    ? Math.max(
        size.width / Math.max(worldWidth, 1),
        size.height / Math.max(worldHeight, 1),
      )
    : Math.min(
        size.width / Math.max(worldWidth, 1),
        size.height / Math.max(worldHeight, 1),
      );

  const clampCamera = useCallback(
    (next: Camera) =>
      constrainCamera(next, {
        baseScale: fitScale,
        viewportWidth: size.width,
        viewportHeight: size.height,
        worldWidth,
        worldHeight,
        coverViewport: !!props.mobilePreview,
      }),
    [
      fitScale,
      props.mobilePreview,
      size.height,
      size.width,
      worldHeight,
      worldWidth,
    ],
  );

  const updateCamera = useCallback<React.Dispatch<React.SetStateAction<Camera>>>(
    (action) => {
      setCamera((current) =>
        clampCamera(
          typeof action === "function" ? action(current) : action,
        ),
      );
    },
    [clampCamera],
  );

  const resetCamera = useCallback(
    () => updateCamera({ x: 0, y: 0, zoom: 1 }),
    [updateCamera],
  );

  useEffect(() => {
    setCamera((current) => clampCamera(current));
  }, [clampCamera]);

  const zoomBy = useCallback(
    (factor: number) => {
      updateCamera((current) => ({
        ...current,
        zoom: current.zoom * factor,
      }));
    },
    [updateCamera],
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = host.getBoundingClientRect();
      const cursorX = event.clientX - rect.left;
      const cursorY = event.clientY - rect.top;
      updateCamera((current) => {
        const oldScale = fitScale * current.zoom;
        const minimumZoom = props.mobilePreview ? 1 : 0.72;
        const nextZoom = Math.max(
          minimumZoom,
          Math.min(3.2, current.zoom * Math.exp(-event.deltaY * 0.0012)),
        );
        const nextScale = fitScale * nextZoom;
        if (nextScale === oldScale) return current;
        const originX = (size.width - worldWidth * oldScale) / 2 + current.x;
        const originY = (size.height - worldHeight * oldScale) / 2 + current.y;
        const worldX = (cursorX - originX) / oldScale;
        const worldY = (cursorY - originY) / oldScale;
        const nextOriginX = cursorX - worldX * nextScale;
        const nextOriginY = cursorY - worldY * nextScale;
        return {
          zoom: nextZoom,
          x: nextOriginX - (size.width - worldWidth * nextScale) / 2,
          y: nextOriginY - (size.height - worldHeight * nextScale) / 2,
        };
      });
    };
    host.addEventListener("wheel", onWheel, { passive: false });
    return () => host.removeEventListener("wheel", onWheel);
  }, [
    fitScale,
    props.mobilePreview,
    size.height,
    size.width,
    updateCamera,
    worldHeight,
    worldWidth,
  ]);

  useEffect(() => {
    if (!props.focusNodeId) return;
    const node = renderedNodes.find((item) => item.id === props.focusNodeId);
    if (!node) return;
    const targetZoom = props.editable ? 1.35 : 1.8;
    const scale = fitScale * targetZoom;
    updateCamera({
      zoom: targetZoom,
      x: size.width / 2 - (node.x / 100) * worldWidth * scale -
        (size.width - worldWidth * scale) / 2,
      y: size.height / 2 - (node.y / 100) * worldHeight * scale -
        (size.height - worldHeight * scale) / 2,
    });
  }, [
    fitScale,
    props.editable,
    props.focusNodeId,
    renderedNodes,
    size.height,
    size.width,
    updateCamera,
    worldHeight,
    worldWidth,
  ]);

  const minimap = useMemo(() => {
    const maximumWidth = 112;
    const maximumHeight = 84;
    const miniatureScale = Math.min(
      maximumWidth / Math.max(worldWidth, 1),
      maximumHeight / Math.max(worldHeight, 1),
    );
    const width = worldWidth * miniatureScale;
    const height = worldHeight * miniatureScale;
    const scale = fitScale * camera.zoom;
    const offsetX = (size.width - worldWidth * scale) / 2 + camera.x;
    const offsetY = (size.height - worldHeight * scale) / 2 + camera.y;
    const left = Math.max(0, -offsetX / scale);
    const top = Math.max(0, -offsetY / scale);
    const right = Math.min(worldWidth, (size.width - offsetX) / scale);
    const bottom = Math.min(worldHeight, (size.height - offsetY) / scale);
    return {
      width,
      height,
      viewport: {
        left: `${(left / worldWidth) * 100}%`,
        top: `${(top / worldHeight) * 100}%`,
        width: `${(Math.max(0, right - left) / worldWidth) * 100}%`,
        height: `${(Math.max(0, bottom - top) / worldHeight) * 100}%`,
      },
    };
  }, [
    camera.x,
    camera.y,
    camera.zoom,
    fitScale,
    size.height,
    size.width,
    worldHeight,
    worldWidth,
  ]);

  const themeClass =
    props.timeOfDay === "night"
      ? "bg-slate-950"
      : props.timeOfDay === "golden"
        ? "bg-amber-950"
        : "bg-sky-950";

  return (
    <div
      ref={hostRef}
      className={cn(
        "relative overflow-hidden border shadow-inner",
        props.mobilePreview
          ? props.previewOrientation === "landscape"
            ? "h-[min(480px,70vh)] min-h-[360px] rounded-[1.5rem]"
            : "h-[min(760px,76vh)] min-h-[600px] rounded-[1.75rem]"
          : "h-[min(760px,74vh)] min-h-[540px] rounded-2xl",
        themeClass,
        props.className,
      )}
    >
      <div className="absolute inset-0 z-10">
        <Application
          resizeTo={hostRef as React.RefObject<HTMLElement>}
          background={props.timeOfDay === "night" ? 0x07111f : 0x10263a}
          antialias
          autoDensity
          resolution={Math.min(window.devicePixelRatio || 1, 2)}
          gcActive
          gcMaxUnusedTime={60_000}
          gcFrequency={30_000}
        >
          <ExplorationStage
            {...props}
            nodes={renderedNodes}
            worldWidth={worldWidth}
            worldHeight={worldHeight}
            viewportWidth={size.width}
            viewportHeight={size.height}
            fitScale={fitScale}
            camera={camera}
            onCameraChange={updateCamera}
            constrainCamera={clampCamera}
          />
        </Application>
      </div>

      <div className="pointer-events-none absolute left-3 top-3 z-20 flex items-center gap-2">
        <Badge className="pointer-events-auto" variant="secondary">
          {props.editable ? "编辑视图" : "玩家预览"}
        </Badge>
        {props.editable && (
          <Badge className="pointer-events-auto" variant="outline">
            {Math.round(camera.zoom * 100)}%
          </Badge>
        )}
      </div>

      {props.mobilePreview ? (
        <div className="absolute bottom-3 right-3 z-20 flex flex-col items-end gap-1.5">
          <div
            className="pointer-events-none relative overflow-hidden rounded-lg border bg-muted shadow-md"
            style={{ width: minimap.width, height: minimap.height }}
            role="img"
            aria-label="地图缩略图与当前视口"
          >
            {props.backgroundUrl &&
              (isVideoSource(props.backgroundUrl) ? (
                <div className="flex size-full items-center justify-center bg-slate-800 text-[9px] text-slate-300">
                  动态底图
                </div>
              ) : (
                <img
                  src={props.backgroundUrl}
                  alt=""
                  className="size-full object-fill"
                  aria-hidden
                />
              ))}
            <div
              className="absolute border-2 border-primary bg-primary/10 shadow-sm"
              style={minimap.viewport}
            />
          </div>
          <div className="flex items-center gap-0.5 rounded-full border bg-background/85 p-0.5 shadow-md backdrop-blur">
            <Button
              aria-label="缩小地图"
              size="icon"
              variant="ghost"
              className="size-7 rounded-full"
              disabled={camera.zoom <= 1.001}
              onClick={() => zoomBy(1 / 1.2)}
            >
              <Minus />
            </Button>
            <span className="w-8 text-center text-[10px] tabular-nums text-muted-foreground">
              {Math.round(camera.zoom * 100)}%
            </span>
            <Button
              aria-label="放大地图"
              size="icon"
              variant="ghost"
              className="size-7 rounded-full"
              disabled={camera.zoom >= 3.199}
              onClick={() => zoomBy(1.2)}
            >
              <Plus />
            </Button>
            <Button
              aria-label="重置视角"
              size="icon"
              variant="secondary"
              className="size-7 rounded-full"
              onClick={resetCamera}
            >
              <LocateFixed />
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1 rounded-xl border bg-background/90 p-1 shadow-lg backdrop-blur">
            <Button
              aria-label="缩小地图"
              size="icon"
              variant="ghost"
              onClick={() => zoomBy(1 / 1.2)}
            >
              <Minus />
            </Button>
            <Button
              aria-label="重置视角"
              size="icon"
              variant="ghost"
              onClick={resetCamera}
            >
              <LocateFixed />
            </Button>
            <Button
              aria-label="放大地图"
              size="icon"
              variant="ghost"
              onClick={() => zoomBy(1.2)}
            >
              <Plus />
            </Button>
          </div>
          <p className="pointer-events-none absolute bottom-4 left-4 z-20 rounded-full bg-background/80 px-3 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur">
            拖动空白处平移 · 滚轮缩放 · 拖动物件调整位置
          </p>
        </>
      )}
    </div>
  );
}

function ExplorationStage({
  backgroundUrl,
  nodes,
  selectedId,
  selectedIds,
  editable,
  emptyLabel,
  worldWidth,
  worldHeight,
  viewportWidth,
  viewportHeight,
  fitScale,
  camera,
  timeOfDay,
  onSelect,
  onOpen,
  onMove,
  nodeBreathing = false,
  maskEditingId,
  maskBrushRadius = 0.08,
  maskRestoring = false,
  showMaskOverlay = false,
  maskKind = "transparency",
  onMaskPoint,
  onMaskEnd,
  onCameraChange,
  constrainCamera: clampCamera,
}: ExplorationPixiCanvasProps & {
  viewportWidth: number;
  viewportHeight: number;
  worldWidth: number;
  worldHeight: number;
  fitScale: number;
  camera: Camera;
  onCameraChange: React.Dispatch<React.SetStateAction<Camera>>;
  constrainCamera: (camera: Camera) => Camera;
}) {
  const worldRef = useRef<Container>(null);
  const videoBackground = isVideoSource(backgroundUrl);
  const imageBackground = useTexture(videoBackground ? null : backgroundUrl);
  const videoTexture = useVideoTexture(videoBackground ? backgroundUrl : null);
  const background = videoTexture ?? imageBackground;
  const draggingWorld = useRef(false);
  const worldDragOrigin = useRef<{
    pointerX: number;
    pointerY: number;
    camera: Camera;
  } | null>(null);
  const worldDragPreview = useRef<Camera | null>(null);
  const nodeRefs = useRef<NodeRefRegistry>(new Map());
  const hoveredNodeIds = useRef(new Set<string>());
  const animationElapsed = useRef(0);
  const scale = fitScale * camera.zoom;
  const offsetX = (viewportWidth - worldWidth * scale) / 2 + camera.x;
  const offsetY = (viewportHeight - worldHeight * scale) / 2 + camera.y;
  const selectedNodeIds = useMemo(
    () => new Set(selectedIds ?? (selectedId ? [selectedId] : [])),
    [selectedId, selectedIds],
  );
  const contentLayers = useMemo(() => {
    const grouped = new Map<
      string,
      { id: string; order: number; nodes: ExplorationNode[] }
    >();
    for (const node of nodes.filter((item) => !item.hidden)) {
      const layerId = node.layerId ?? "content";
      const existing = grouped.get(layerId);
      if (existing) existing.nodes.push(node);
      else {
        grouped.set(layerId, {
          id: layerId,
          order: node.layerOrder ?? 1,
          nodes: [node],
        });
      }
    }
    return [...grouped.values()].sort((a, b) => a.order - b.order);
  }, [nodes]);

  const registerNodeRef = useCallback(
    (id: string, instance: Container | null) => {
      if (instance) nodeRefs.current.set(id, instance);
      else nodeRefs.current.delete(id);
    },
    [],
  );

  const applyNodeScale = useCallback(
    (node: ExplorationNode, activeScale: number) => {
      const instance = nodeRefs.current.get(node.id);
      if (!instance) return;
      instance.scale.set(activeScale);
      instance.y =
        (node.y / 100) * worldHeight +
        ((activeScale - 1) * node.height) / 2;
    },
    [worldHeight],
  );

  useTick({
    isEnabled: !editable && nodeBreathing,
    callback: (ticker) => {
      animationElapsed.current += ticker.deltaMS;
      const activeScale =
        1.02 + Math.sin(animationElapsed.current / 240) * 0.006;
      for (const node of nodes) {
        if (
          selectedNodeIds.has(node.id) &&
          !hoveredNodeIds.current.has(node.id)
        ) {
          applyNodeScale(node, activeScale);
        }
      }
    },
  });

  useEffect(() => {
    if (!editable && nodeBreathing) return;
    for (const node of nodes) {
      if (!hoveredNodeIds.current.has(node.id)) applyNodeScale(node, 1);
    }
  }, [applyNodeScale, editable, nodeBreathing, nodes]);

  const previewNodeDrag = useCallback(
    (nodeId: string, dx: number, dy: number) => {
      const activeNode = nodes.find((item) => item.id === nodeId);
      if (!activeNode) return;
      const movedNodes = activeNode.groupId
        ? nodes.filter((item) => item.groupId === activeNode.groupId)
        : [activeNode];
      for (const node of movedNodes) {
        const instance = nodeRefs.current.get(node.id);
        if (!instance) continue;
        instance.position.set(
          (node.x / 100) * worldWidth + dx,
          (node.y / 100) * worldHeight + dy,
        );
      }
    },
    [nodes, worldHeight, worldWidth],
  );

  const cancelNodeDrag = useCallback(() => {
    for (const node of nodes) {
      const instance = nodeRefs.current.get(node.id);
      if (!instance) continue;
      instance.position.set(
        (node.x / 100) * worldWidth,
        (node.y / 100) * worldHeight,
      );
    }
  }, [nodes, worldHeight, worldWidth]);

  const drawFrame = useCallback(
    (g: PixiGraphics) => {
      g.clear()
        .roundRect(0, 0, worldWidth, worldHeight, 24)
        .fill({ color: 0x182131 })
        .stroke({ color: 0xffffff, alpha: 0.1, width: 2 / scale });
    },
    [scale, worldHeight, worldWidth],
  );

  useEffect(() => {
    const world = worldRef.current;
    if (!world || backgroundUrl) return;
    const empty = new PixiText({
      text: emptyLabel,
      style: {
        fontFamily: "Nunito, sans-serif",
        fontSize: 28,
        align: "center",
        fill: 0x94a3b8,
      },
    });
    empty.anchor.set(0.5);
    empty.position.set(worldWidth / 2, worldHeight / 2);
    world.addChild(empty);
    return () => empty.destroy();
  }, [backgroundUrl, emptyLabel, worldHeight, worldWidth]);

  return (
    <pixiContainer
      ref={worldRef}
      label="camera-world"
      x={offsetX}
      y={offsetY}
      scale={scale}
      sortableChildren
      isRenderGroup
    >
      <pixiGraphics
        zIndex={0}
        draw={drawFrame}
        eventMode="static"
        cursor="grab"
        onPointerDown={(event: FederatedPointerEvent) => {
          draggingWorld.current = true;
          worldDragOrigin.current = {
            pointerX: event.global.x,
            pointerY: event.global.y,
            camera,
          };
          worldDragPreview.current = camera;
        }}
        onGlobalPointerMove={(event: FederatedPointerEvent) => {
          const origin = worldDragOrigin.current;
          const world = worldRef.current;
          if (!draggingWorld.current || !origin || !world) return;
          const next = clampCamera({
            ...origin.camera,
            x: origin.camera.x + event.global.x - origin.pointerX,
            y: origin.camera.y + event.global.y - origin.pointerY,
          });
          worldDragPreview.current = next;
          const nextScale = fitScale * next.zoom;
          world.position.set(
            (viewportWidth - worldWidth * nextScale) / 2 + next.x,
            (viewportHeight - worldHeight * nextScale) / 2 + next.y,
          );
        }}
        onPointerUp={() => {
          draggingWorld.current = false;
          worldDragOrigin.current = null;
          if (worldDragPreview.current) {
            onCameraChange(worldDragPreview.current);
            worldDragPreview.current = null;
          }
        }}
        onPointerUpOutside={() => {
          draggingWorld.current = false;
          worldDragOrigin.current = null;
          if (worldDragPreview.current) {
            onCameraChange(worldDragPreview.current);
            worldDragPreview.current = null;
          }
        }}
        onPointerCancel={() => {
          draggingWorld.current = false;
          worldDragOrigin.current = null;
          worldDragPreview.current = null;
          const world = worldRef.current;
          if (world) {
            world.position.set(offsetX, offsetY);
          }
        }}
      />
      <pixiContainer
        label="background-layer"
        zIndex={1}
        eventMode="none"
        interactiveChildren={false}
      >
        {background && (
          <pixiSprite
            texture={background}
            width={worldWidth}
            height={worldHeight}
            eventMode="none"
          />
        )}
        <pixiGraphics
          eventMode="none"
          draw={(g: PixiGraphics) => {
            g.clear();
            const color =
              timeOfDay === "night"
                ? 0x07111f
                : timeOfDay === "golden"
                  ? 0xff9b42
                  : 0xffffff;
            const alpha =
              timeOfDay === "night"
                ? 0.32
                : timeOfDay === "golden"
                  ? 0.12
                  : 0;
            g.rect(0, 0, worldWidth, worldHeight).fill({ color, alpha });
          }}
        />
      </pixiContainer>
      {contentLayers.map((layer) => (
        <pixiContainer
          key={layer.id}
          label={`content-layer:${layer.id}`}
          zIndex={100 + layer.order}
          sortableChildren
        >
          {layer.nodes.map((node) => (
            <ExplorationNodeEntry
              key={node.id}
              node={node}
              selected={selectedNodeIds.has(node.id)}
              editable={editable}
              viewportScale={scale}
              worldWidth={worldWidth}
              worldHeight={worldHeight}
              onSelect={onSelect}
              onOpen={onOpen}
              onRegisterRef={registerNodeRef}
              onHoverChange={(nodeId, hovered) => {
                if (hovered) hoveredNodeIds.current.add(nodeId);
                else hoveredNodeIds.current.delete(nodeId);
              }}
              onDragPreview={previewNodeDrag}
              onDragCancel={cancelNodeDrag}
              onDragCommit={(nodeId, x, y) => {
                onMove(nodeId, x, y);
              }}
              erasing={editable && maskEditingId === node.id}
              onMaskPoint={onMaskPoint}
              maskBrushRadius={maskBrushRadius}
              maskRestoring={maskRestoring}
              showMaskOverlay={showMaskOverlay}
              maskKind={maskKind}
              onMaskEnd={onMaskEnd}
            />
          ))}
        </pixiContainer>
      ))}
      <pixiContainer
        label="foreground-occlusion-layer"
        zIndex={10_000}
        sortableChildren
        eventMode="none"
      >
        {nodes
          .filter(
            (node) =>
              !node.hidden &&
              node.imageUrl &&
              node.occlusionMask?.points.length,
          )
          .map((node) => (
            <OcclusionNode
              key={`occlusion-${node.id}`}
              node={node}
              worldWidth={worldWidth}
              worldHeight={worldHeight}
            />
          ))}
      </pixiContainer>
    </pixiContainer>
  );
}

function useNodeVisualTreatment(style?: LocationVisualStyle) {
  const colorFilter = useMemo(() => {
    if (!style) return null;
    const isNeutral =
      Math.abs(style.brightness - 1) < 0.001 &&
      Math.abs(style.contrast - 1) < 0.001 &&
      Math.abs(style.saturation - 1) < 0.001 &&
      Math.abs(style.hue) < 0.001;
    if (isNeutral) return null;
    const filter = new ColorMatrixFilter({ resolution: 1 });
    filter.brightness(style.brightness, false);
    filter.contrast(Math.max(0, Math.min(1, style.contrast / 2)), true);
    filter.saturate(style.saturation - 1, true);
    filter.hue(style.hue, true);
    return filter;
  }, [style]);

  useEffect(
    () => () => {
      colorFilter?.destroy();
    },
    [colorFilter],
  );

  const colorTint = useMemo(() => {
    const warmth = style?.warmth ?? 0;
    const amount = Math.min(1, Math.abs(warmth));
    const target = warmth >= 0 ? [255, 210, 160] : [170, 210, 255];
    const channel = (value: number) =>
      Math.round(255 + (value - 255) * amount);
    return (
      (channel(target[0]) << 16) |
      (channel(target[1]) << 8) |
      channel(target[2])
    );
  }, [style?.warmth]);

  return { colorFilter, colorTint };
}

function ExplorationNodeEntry(
  props: Omit<
    React.ComponentProps<typeof HotspotNode>,
    "colorFilter" | "colorTint"
  >,
) {
  const treatment = useNodeVisualTreatment(props.node.visualStyle);
  return <HotspotNode {...props} {...treatment} />;
}

function HotspotNode({
  node,
  editable,
  viewportScale,
  worldWidth,
  worldHeight,
  onSelect,
  onOpen,
  onDragPreview,
  onDragCancel,
  onDragCommit,
  erasing,
  onMaskPoint,
  maskBrushRadius,
  maskRestoring,
  showMaskOverlay,
  maskKind,
  onMaskEnd,
  onRegisterRef,
  onHoverChange,
  colorFilter,
  colorTint,
}: {
  node: ExplorationNode;
  editable: boolean;
  viewportScale: number;
  worldWidth: number;
  worldHeight: number;
  onSelect: (id: string, additive?: boolean) => void;
  onOpen: (id: string) => void;
  onDragPreview: (id: string, dx: number, dy: number) => void;
  onDragCancel: () => void;
  onDragCommit: (id: string, x: number, y: number) => void;
  erasing: boolean;
  onMaskPoint?: (id: string, point: ResourceMaskPoint) => void;
  maskBrushRadius: number;
  maskRestoring: boolean;
  showMaskOverlay: boolean;
  maskKind: "transparency" | "occlusion";
  onMaskEnd?: () => void;
  onRegisterRef: (id: string, instance: Container | null) => void;
  onHoverChange: (id: string, hovered: boolean) => void;
  colorFilter: ColorMatrixFilter | null;
  colorTint: number;
}) {
  const ref = useRef<Container>(null);
  const texture = useTexture(node.imageUrl);
  const dragging = useRef(false);
  const moved = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const dragDelta = useRef({ x: 0, y: 0 });
  const erasingPointer = useRef(false);
  const [maskGraphic, setMaskGraphic] = useState<Graphics | null>(null);
  const spriteRef = useRef<Sprite>(null);
  const shadowRef = useRef<Sprite>(null);
  const editingMask =
    maskKind === "occlusion" ? node.occlusionMask : node.mask;
  const hitArea = useMemo(
    () =>
      new Rectangle(-node.width / 2, -node.height, node.width, node.height),
    [node.height, node.width],
  );

  const drawGlow = useCallback(
    (g: PixiGraphics) => {
      g.clear();
      const accent =
        node.kind === "object" ? 0x60a5fa : node.kind === "room" ? 0xa78bfa : 0xfbbf24;
      if (!texture) {
        g.roundRect(
          -node.width / 2,
          -node.height,
          node.width,
          node.height,
          18,
        )
          .fill({ color: node.disabled ? 0x475569 : accent, alpha: 0.88 })
          .stroke({ color: 0xffffff, alpha: 0.7, width: 2 / viewportScale });
      }
      if (node.required) {
        g.circle(node.width / 2 - 7, -node.height + 7, 9)
          .fill({ color: 0xf97316 })
          .stroke({ color: 0xffffff, width: 2 / viewportScale });
      }
    },
    [
      node.disabled,
      node.height,
      node.kind,
      node.required,
      node.width,
      texture,
      viewportScale,
    ],
  );

  const drawMask = useCallback(
    (g: PixiGraphics) => {
      g.clear();
      for (const point of node.mask?.points ?? []) {
        g.circle(
          -node.width / 2 + point.x * node.width,
          -node.height + point.y * node.height,
          point.radius * Math.max(node.width, node.height),
        ).fill(0xffffff);
      }
    },
    [node.height, node.mask?.points, node.width],
  );

  useEffect(() => {
    const sprite = spriteRef.current;
    if (!sprite) return;
    if (maskGraphic) {
      sprite.setMask({ mask: maskGraphic, inverse: true });
      shadowRef.current?.setMask({ mask: maskGraphic, inverse: true });
    } else {
      sprite.mask = null;
      if (shadowRef.current) shadowRef.current.mask = null;
    }
    return () => {
      sprite.mask = null;
      if (shadowRef.current) shadowRef.current.mask = null;
    };
  }, [maskGraphic]);

  const drawMaskPreview = useCallback(
    (g: PixiGraphics) => {
      g.clear();
      if (!erasing) return;
      for (const point of editingMask?.points ?? []) {
        g.circle(
          -node.width / 2 + point.x * node.width,
          -node.height + point.y * node.height,
          point.radius * Math.max(node.width, node.height),
        ).fill(0xffffff);
      }
    },
    [editingMask?.points, erasing, node.height, node.width],
  );

  const addMaskPoint = (event: FederatedPointerEvent) => {
    if (!erasing || !ref.current || !onMaskPoint) return;
    const local = ref.current.toLocal(event.global);
    onMaskPoint(node.id, {
      x: Math.max(0, Math.min(1, (local.x + node.width / 2) / node.width)),
      y: Math.max(0, Math.min(1, (local.y + node.height) / node.height)),
      radius: maskBrushRadius,
    });
  };

  return (
    <pixiContainer
      ref={(instance) => {
        ref.current = instance;
        onRegisterRef(node.id, instance);
      }}
      label={`exploration-node:${node.id}`}
      x={(node.x / 100) * worldWidth}
      y={(node.y / 100) * worldHeight}
      zIndex={Math.round((node.y / 100) * worldHeight)}
      alpha={node.disabled ? 0.5 : 1}
      eventMode="static"
      interactiveChildren={false}
      hitArea={hitArea}
      accessible={!editable}
      accessibleTitle={node.title}
      accessibleHint={node.subtitle || "打开探索内容"}
      tabIndex={!editable ? 0 : -1}
      cursor={
        erasing
          ? maskRestoring
            ? MASK_RESTORE_CURSOR
            : MASK_BRUSH_CURSOR
          : editable
            ? "grab"
            : "pointer"
      }
      onPointerOver={() => {
        if (editable || !ref.current) return;
        onHoverChange(node.id, true);
        ref.current.scale.set(1.2);
        ref.current.y =
          (node.y / 100) * worldHeight + ((1.2 - 1) * node.height) / 2;
      }}
      onPointerOut={() => {
        if (editable || !ref.current) return;
        onHoverChange(node.id, false);
        ref.current.scale.set(1);
        ref.current.y = (node.y / 100) * worldHeight;
      }}
      onPointerDown={(event: FederatedPointerEvent) => {
        event.stopPropagation();
        if (erasing) {
          erasingPointer.current = true;
          addMaskPoint(event);
          return;
        }
        dragging.current = editable;
        moved.current = false;
        if (editable && ref.current) {
          const parentPoint = ref.current.parent?.toLocal(event.global);
          if (parentPoint) {
            dragStart.current = parentPoint;
            dragDelta.current = { x: 0, y: 0 };
          }
        }
      }}
      onGlobalPointerMove={(event: FederatedPointerEvent) => {
        if (erasingPointer.current && erasing) {
          addMaskPoint(event);
          return;
        }
        if (!dragging.current || !editable) return;
        const parentPoint = ref.current?.parent?.toLocal(event.global);
        if (!parentPoint) return;
        moved.current = true;
        dragDelta.current = {
          x: parentPoint.x - dragStart.current.x,
          y: parentPoint.y - dragStart.current.y,
        };
        onDragPreview(node.id, dragDelta.current.x, dragDelta.current.y);
      }}
      onPointerUp={(event: FederatedPointerEvent) => {
        event.stopPropagation();
        if (erasingPointer.current) {
          erasingPointer.current = false;
          onMaskEnd?.();
          return;
        }
        if (dragging.current && moved.current) {
          onDragCommit(
            node.id,
            Math.round(
              Math.max(
                0,
                Math.min(
                  100,
                  (((node.x / 100) * worldWidth + dragDelta.current.x) /
                    worldWidth) *
                    100,
                ),
              ) * 10,
            ) / 10,
            Math.round(
              Math.max(
                0,
                Math.min(
                  100,
                  (((node.y / 100) * worldHeight + dragDelta.current.y) /
                    worldHeight) *
                    100,
                ),
              ) * 10,
            ) / 10,
          );
        }
        dragging.current = false;
      }}
      onPointerTap={(event: FederatedPointerEvent) => {
        event.stopPropagation();
        if (erasing || moved.current) return;
        onSelect(
          node.id,
          !!(event.shiftKey || event.ctrlKey || event.metaKey),
        );
        if (!editable) onOpen(node.id);
      }}
      onPointerUpOutside={() => {
        dragging.current = false;
        onDragCancel();
        if (erasingPointer.current) onMaskEnd?.();
        erasingPointer.current = false;
      }}
      onPointerCancel={() => {
        dragging.current = false;
        moved.current = false;
        erasingPointer.current = false;
        onDragCancel();
      }}
    >
      <pixiGraphics draw={drawGlow} />
      {texture && node.mask?.points.length ? (
        <pixiGraphics
          ref={setMaskGraphic}
          eventMode="none"
          draw={drawMask}
        />
      ) : null}
      {texture && (
        <pixiSprite
          ref={shadowRef}
          texture={texture}
          anchor={{ x: 0.5, y: 1 }}
          width={node.width}
          height={node.height}
          x={4}
          y={7}
          tint={0x000000}
          alpha={node.visualStyle?.shadowOpacity ?? 0}
          eventMode="none"
        />
      )}
      {texture && (
        <pixiSprite
          ref={spriteRef}
          texture={texture}
          filters={colorFilter ? [colorFilter] : undefined}
          tint={colorTint}
          anchor={{ x: 0.5, y: 1 }}
          width={node.width}
          height={node.height}
          eventMode="none"
        />
      )}
      {erasing && showMaskOverlay && (
        <pixiGraphics
          eventMode="none"
          alpha={0.36}
          tint={maskKind === "occlusion" ? 0x3b82f6 : 0xef4444}
          draw={drawMaskPreview}
        />
      )}
    </pixiContainer>
  );
}

function OcclusionNode({
  node,
  worldWidth,
  worldHeight,
}: {
  node: ExplorationNode;
  worldWidth: number;
  worldHeight: number;
}) {
  const texture = useTexture(node.imageUrl);
  const spriteRef = useRef<Sprite>(null);
  const [maskGraphic, setMaskGraphic] = useState<Graphics | null>(null);
  const { colorFilter, colorTint } = useNodeVisualTreatment(node.visualStyle);
  const drawMask = useCallback(
    (g: PixiGraphics) => {
      g.clear();
      for (const point of node.occlusionMask?.points ?? []) {
        g.circle(
          -node.width / 2 + point.x * node.width,
          -node.height + point.y * node.height,
          point.radius * Math.max(node.width, node.height),
        ).fill(0xffffff);
      }
    },
    [node.height, node.occlusionMask?.points, node.width],
  );
  useEffect(() => {
    if (!spriteRef.current) return;
    spriteRef.current.mask = maskGraphic;
    return () => {
      if (spriteRef.current) spriteRef.current.mask = null;
    };
  }, [maskGraphic]);
  if (!texture) return null;
  return (
    <pixiContainer
      x={(node.x / 100) * worldWidth}
      y={(node.y / 100) * worldHeight}
      zIndex={
        (node.layerOrder ?? 1) * 100_000 +
        Math.round((node.y / 100) * worldHeight)
      }
      eventMode="none"
    >
      <pixiGraphics ref={setMaskGraphic} eventMode="none" draw={drawMask} />
      <pixiSprite
        ref={spriteRef}
        texture={texture}
        filters={colorFilter ? [colorFilter] : undefined}
        tint={colorTint}
        anchor={{ x: 0.5, y: 1 }}
        width={node.width}
        height={node.height}
        eventMode="none"
      />
    </pixiContainer>
  );
}

function useVideoTexture(url?: string | null) {
  const [texture, setTexture] = useState<Texture | null>(null);
  useEffect(() => {
    if (!url) {
      setTexture(null);
      return;
    }
    let active = true;
    retainAsset(url);
    void Assets.load({
      src: url,
      parser: "video",
      data: {
        autoPlay: true,
        loop: true,
        muted: true,
        playsinline: true,
        preload: true,
        scaleMode: "linear",
      },
    })
      .then((loaded) => {
        if (active) setTexture(loaded as Texture);
      })
      .catch(() => {
        if (active) setTexture(null);
      });
    return () => {
      active = false;
      releaseAsset(url);
    };
  }, [url]);
  return texture;
}

function useTexture(url?: string | null) {
  const [texture, setTexture] = useState<Texture | null>(null);
  useEffect(() => {
    let active = true;
    if (!url) {
      setTexture(null);
      return;
    }
    retainAsset(url);
    Assets.load({
      src: url,
      parser: "texture",
      data: { scaleMode: "linear" },
    })
      .then((loaded) => {
        if (active) {
          setTexture(loaded as Texture);
        }
      })
      .catch(() => {
        if (active) setTexture(null);
      });
    return () => {
      active = false;
      releaseAsset(url);
    };
  }, [url]);
  return texture;
}
