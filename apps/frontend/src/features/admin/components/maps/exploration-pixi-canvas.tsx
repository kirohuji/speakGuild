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
  mobilePreview?: boolean;
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

function isVideoSource(url?: string | null) {
  return (
    !!url &&
    (/\.(mp4|webm|ogg|mov|m4v)(?:[?#]|$)/i.test(url) ||
      /[#&?]media=video(?:&|$)/i.test(url))
  );
}

const MASK_BRUSH_CURSOR =
  'url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2232%22 height=%2232%22 viewBox=%220 0 32 32%22%3E%3Ccircle cx=%2216%22 cy=%2216%22 r=%2211%22 fill=%22none%22 stroke=%22%23ef4444%22 stroke-width=%222%22/%3E%3Cpath d=%22M16 3v5M16 24v5M3 16h5M24 16h5%22 stroke=%22%23fff%22 stroke-width=%222%22/%3E%3C/svg%3E") 16 16, crosshair';
const MASK_RESTORE_CURSOR =
  'url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2232%22 height=%2232%22 viewBox=%220 0 32 32%22%3E%3Ccircle cx=%2216%22 cy=%2216%22 r=%2211%22 fill=%22none%22 stroke=%22%2322c55e%22 stroke-width=%222%22/%3E%3Cpath d=%22M16 3v5M16 24v5M3 16h5M24 16h5%22 stroke=%22%23fff%22 stroke-width=%222%22/%3E%3C/svg%3E") 16 16, crosshair';

export function ExplorationPixiCanvas({
  worldWidth = 1600,
  worldHeight = 900,
  ...props
}: ExplorationPixiCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 960, height: 620 });
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, zoom: 1 });

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const update = () => {
      const rect = host.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      setSize({
        width: Math.max(280, Math.round(rect.width)),
        height: Math.max(420, Math.round(rect.height)),
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
  }, [props.mobilePreview]);

  const fitScale = Math.min(
    size.width / Math.max(worldWidth, 1),
    size.height / Math.max(worldHeight, 1),
  );

  const resetCamera = useCallback(
    () => setCamera({ x: 0, y: 0, zoom: 1 }),
    [],
  );

  const zoomBy = useCallback((factor: number) => {
    setCamera((current) => ({
      ...current,
      zoom: Math.max(0.72, Math.min(3.2, current.zoom * factor)),
    }));
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = host.getBoundingClientRect();
      const cursorX = event.clientX - rect.left;
      const cursorY = event.clientY - rect.top;
      setCamera((current) => {
        const oldScale = fitScale * current.zoom;
        const nextZoom = Math.max(
          0.72,
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
  }, [fitScale, size.height, size.width, worldHeight, worldWidth]);

  useEffect(() => {
    if (!props.focusNodeId) return;
    const node = props.nodes.find((item) => item.id === props.focusNodeId);
    if (!node) return;
    const targetZoom = props.editable ? 1.35 : 1.8;
    const scale = fitScale * targetZoom;
    setCamera({
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
    props.nodes,
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
      className={`relative overflow-hidden border shadow-inner ${
        props.mobilePreview
          ? "h-[min(760px,76vh)] min-h-[600px] rounded-[1.75rem]"
          : "h-[min(760px,74vh)] min-h-[540px] rounded-2xl"
      } ${themeClass}`}
    >
      <div className="absolute inset-0 z-10">
        <Application
          resizeTo={hostRef as React.RefObject<HTMLElement>}
          background={props.timeOfDay === "night" ? 0x07111f : 0x10263a}
          antialias
          autoDensity
          resolution={Math.min(window.devicePixelRatio || 1, 2)}
        >
          <ExplorationStage
            {...props}
            worldWidth={worldWidth}
            worldHeight={worldHeight}
            viewportWidth={size.width}
            viewportHeight={size.height}
            fitScale={fitScale}
            camera={camera}
            onCameraChange={setCamera}
          />
        </Application>
      </div>

      <div className="pointer-events-none absolute left-3 top-3 z-20 flex items-center gap-2">
        <Badge className="pointer-events-auto" variant="secondary">
          {props.editable ? "编辑视图" : "玩家预览"}
        </Badge>
        <Badge className="pointer-events-auto" variant="outline">
          {Math.round(camera.zoom * 100)}%
        </Badge>
      </div>

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
        拖动空白处平移 · 滚轮缩放
        {props.editable ? " · 拖动物件调整位置" : " · 点击探索"}
      </p>
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
  maskEditingId,
  maskBrushRadius = 0.08,
  maskRestoring = false,
  showMaskOverlay = false,
  maskKind = "transparency",
  onMaskPoint,
  onMaskEnd,
  onCameraChange,
}: ExplorationPixiCanvasProps & {
  viewportWidth: number;
  viewportHeight: number;
  worldWidth: number;
  worldHeight: number;
  fitScale: number;
  camera: Camera;
  onCameraChange: React.Dispatch<React.SetStateAction<Camera>>;
}) {
  const worldRef = useRef<Container>(null);
  const videoBackground = isVideoSource(backgroundUrl);
  const imageBackground = useTexture(videoBackground ? null : backgroundUrl);
  const videoTexture = useVideoTexture(videoBackground ? backgroundUrl : null);
  const background = videoTexture ?? imageBackground;
  const draggingWorld = useRef(false);
  const [dragPreview, setDragPreview] = useState<{
    nodeId: string;
    groupId?: string;
    dx: number;
    dy: number;
  } | null>(null);
  const worldStart = useRef({ x: 0, y: 0, cameraX: 0, cameraY: 0 });
  const scale = fitScale * camera.zoom;
  const offsetX = (viewportWidth - worldWidth * scale) / 2 + camera.x;
  const offsetY = (viewportHeight - worldHeight * scale) / 2 + camera.y;

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
      x={offsetX}
      y={offsetY}
      scale={scale}
      sortableChildren
    >
      <pixiGraphics
        draw={drawFrame}
        eventMode="static"
        cursor="grab"
        onPointerDown={(event: FederatedPointerEvent) => {
          draggingWorld.current = true;
          worldStart.current = {
            x: event.global.x,
            y: event.global.y,
            cameraX: camera.x,
            cameraY: camera.y,
          };
        }}
        onGlobalPointerMove={(event: FederatedPointerEvent) => {
          if (!draggingWorld.current) return;
          onCameraChange((current) => ({
            ...current,
            x: worldStart.current.cameraX + event.global.x - worldStart.current.x,
            y: worldStart.current.cameraY + event.global.y - worldStart.current.y,
          }));
        }}
        onPointerUp={() => {
          draggingWorld.current = false;
        }}
        onPointerUpOutside={() => {
          draggingWorld.current = false;
        }}
      />
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
            timeOfDay === "night" ? 0.32 : timeOfDay === "golden" ? 0.12 : 0;
          g.rect(0, 0, worldWidth, worldHeight).fill({ color, alpha });
        }}
      />
      {nodes
        .filter((node) => !node.hidden)
        .map((node) => (
          <HotspotNode
            key={node.id}
            node={node}
            selected={
              selectedIds?.includes(node.id) ?? node.id === selectedId
            }
            dragOffset={
              dragPreview &&
              (dragPreview.nodeId === node.id ||
                (!!dragPreview.groupId &&
                  dragPreview.groupId === node.groupId))
                ? { x: dragPreview.dx, y: dragPreview.dy }
                : undefined
            }
            editable={editable}
            viewportScale={scale}
            worldWidth={worldWidth}
            worldHeight={worldHeight}
            onSelect={onSelect}
            onOpen={onOpen}
            onDragPreview={(nodeId, dx, dy) => {
              const activeNode = nodes.find((item) => item.id === nodeId);
              setDragPreview({
                nodeId,
                groupId: activeNode?.groupId,
                dx,
                dy,
              });
            }}
            onDragCancel={() => setDragPreview(null)}
            onDragCommit={(nodeId, x, y) => {
              setDragPreview(null);
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
  );
}

function HotspotNode({
  node,
  selected,
  dragOffset: previewDragOffset,
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
}: {
  node: ExplorationNode;
  selected: boolean;
  dragOffset?: { x: number; y: number };
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
}) {
  const ref = useRef<Container>(null);
  const texture = useTexture(node.imageUrl);
  const [hovered, setHovered] = useState(false);
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
  const colorFilter = useMemo(() => {
    const style = node.visualStyle;
    if (!style) return null;
    const isNeutral =
      Math.abs(style.brightness - 1) < 0.001 &&
      Math.abs(style.contrast - 1) < 0.001 &&
      Math.abs(style.saturation - 1) < 0.001 &&
      Math.abs(style.hue) < 0.001;
    if (isNeutral) return null;
    const filter = new ColorMatrixFilter();
    filter.resolution = 2;
    filter.brightness(style.brightness, false);
    filter.contrast(style.contrast - 1, true);
    filter.saturate(style.saturation - 1, true);
    filter.hue(style.hue, true);
    return filter;
  }, [node.visualStyle]);
  const colorTint = useMemo(() => {
    const warmth = node.visualStyle?.warmth ?? 0;
    const amount = Math.min(1, Math.abs(warmth));
    const target = warmth >= 0 ? [255, 210, 160] : [170, 210, 255];
    const channel = (value: number) =>
      Math.round(255 + (value - 255) * amount);
    return (
      (channel(target[0]) << 16) |
      (channel(target[1]) << 8) |
      channel(target[2])
    );
  }, [node.visualStyle?.warmth]);

  useTick(() => {
    if (!ref.current) return;
    const activeScale =
      !editable && (selected || hovered)
        ? 1.04 + Math.sin(performance.now() / 240) * 0.012
        : 1;
    ref.current.scale.set(activeScale);
  });

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
      ref={ref}
      x={(node.x / 100) * worldWidth + (previewDragOffset?.x ?? 0)}
      y={(node.y / 100) * worldHeight + (previewDragOffset?.y ?? 0)}
      zIndex={
        (node.layerOrder ?? 1) * 100000 +
        Math.round((node.y / 100) * worldHeight)
      }
      alpha={node.disabled ? 0.5 : 1}
      eventMode="static"
      hitArea={new Rectangle(-node.width / 2, -node.height, node.width, node.height)}
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
        if (!editable) setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
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
        } else {
          const pointerEvent = event as FederatedPointerEvent & {
            shiftKey?: boolean;
            ctrlKey?: boolean;
            metaKey?: boolean;
          };
          onSelect(
            node.id,
            !!(
              pointerEvent.shiftKey ||
              pointerEvent.ctrlKey ||
              pointerEvent.metaKey
            ),
          );
          if (!editable) onOpen(node.id);
        }
        dragging.current = false;
      }}
      onPointerUpOutside={() => {
        dragging.current = false;
        onDragCancel();
        if (erasingPointer.current) onMaskEnd?.();
        erasingPointer.current = false;
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
          y={!editable && hovered ? -10 : 0}
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
  const colorFilter = useMemo(() => {
    const style = node.visualStyle;
    if (!style) return null;
    const isNeutral =
      Math.abs(style.brightness - 1) < 0.001 &&
      Math.abs(style.contrast - 1) < 0.001 &&
      Math.abs(style.saturation - 1) < 0.001 &&
      Math.abs(style.hue) < 0.001;
    if (isNeutral) return null;
    const filter = new ColorMatrixFilter();
    filter.resolution = 2;
    filter.brightness(style.brightness, false);
    filter.contrast(style.contrast - 1, true);
    filter.saturate(style.saturation - 1, true);
    filter.hue(style.hue, true);
    return filter;
  }, [node.visualStyle]);
  const colorTint = useMemo(() => {
    const warmth = node.visualStyle?.warmth ?? 0;
    const amount = Math.min(1, Math.abs(warmth));
    const target = warmth >= 0 ? [255, 210, 160] : [170, 210, 255];
    const channel = (value: number) =>
      Math.round(255 + (value - 255) * amount);
    return (
      (channel(target[0]) << 16) |
      (channel(target[1]) << 8) |
      channel(target[2])
    );
  }, [node.visualStyle?.warmth]);
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
      zIndex={(node.layerOrder ?? 1) * 100000 + 99999}
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
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.loop = true;
    video.autoplay = true;
    video.playsInline = true;
    video.preload = "auto";
    let active = true;
    let createdTexture: Texture | null = null;
    const createTexture = () => {
      if (!active || createdTexture) return;
      createdTexture = Texture.from(video);
      createdTexture.source.scaleMode = "linear";
      setTexture(createdTexture);
      void video.play().catch(() => undefined);
    };
    video.addEventListener("loadeddata", createTexture, { once: true });
    video.src = url;
    video.load();
    return () => {
      active = false;
      video.pause();
      video.removeEventListener("loadeddata", createTexture);
      createdTexture?.destroy();
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
    Assets.load(url)
      .then((loaded) => {
        if (active) {
          const loadedTexture = loaded as Texture;
          loadedTexture.source.scaleMode = "linear";
          setTexture(loadedTexture);
        }
      })
      .catch(() => {
        if (active) setTexture(null);
      });
    return () => {
      active = false;
    };
  }, [url]);
  return texture;
}
