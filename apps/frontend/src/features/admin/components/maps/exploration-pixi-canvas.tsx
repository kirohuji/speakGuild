import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Application, extend, useTick } from "@pixi/react";
import {
  Assets,
  Container,
  Graphics,
  Sprite,
  Text as PixiText,
  Texture,
  type FederatedPointerEvent,
  type Graphics as PixiGraphics,
} from "pixi.js";
import { LocateFixed, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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
};

interface ExplorationPixiCanvasProps {
  backgroundUrl?: string | null;
  nodes: ExplorationNode[];
  selectedId?: string;
  focusNodeId?: string;
  editable: boolean;
  emptyLabel: string;
  worldWidth?: number;
  worldHeight?: number;
  timeOfDay?: "day" | "golden" | "night";
  mobilePreview?: boolean;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
}

type Camera = { x: number; y: number; zoom: number };

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

      <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2">
        <Badge className="pointer-events-auto" variant="secondary">
          {props.editable ? "编辑视图" : "玩家预览"}
        </Badge>
        <Badge className="pointer-events-auto" variant="outline">
          {Math.round(camera.zoom * 100)}%
        </Badge>
      </div>

      <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-xl border bg-background/90 p-1 shadow-lg backdrop-blur">
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

      <p className="pointer-events-none absolute bottom-4 left-4 rounded-full bg-background/80 px-3 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur">
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
  const background = useTexture(backgroundUrl);
  const draggingWorld = useRef(false);
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
            selected={node.id === selectedId}
            editable={editable}
            viewportScale={scale}
            worldWidth={worldWidth}
            worldHeight={worldHeight}
            onSelect={onSelect}
            onOpen={onOpen}
            onMove={onMove}
          />
        ))}
    </pixiContainer>
  );
}

function HotspotNode({
  node,
  selected,
  editable,
  viewportScale,
  worldWidth,
  worldHeight,
  onSelect,
  onOpen,
  onMove,
}: {
  node: ExplorationNode;
  selected: boolean;
  editable: boolean;
  viewportScale: number;
  worldWidth: number;
  worldHeight: number;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
}) {
  const ref = useRef<Container>(null);
  const texture = useTexture(node.imageUrl);
  const [hovered, setHovered] = useState(false);
  const dragging = useRef(false);
  const moved = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

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

  return (
    <pixiContainer
      ref={ref}
      x={(node.x / 100) * worldWidth}
      y={(node.y / 100) * worldHeight}
      zIndex={Math.round((node.y / 100) * worldHeight)}
      alpha={node.disabled ? 0.5 : 1}
      eventMode="static"
      cursor={editable ? "grab" : "pointer"}
      onPointerOver={() => {
        if (!editable) setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
      onPointerDown={(event: FederatedPointerEvent) => {
        event.stopPropagation();
        dragging.current = editable;
        moved.current = false;
        if (editable && ref.current) {
          const parentPoint = ref.current.parent?.toLocal(event.global);
          if (parentPoint) {
            dragOffset.current = {
              x: ref.current.x - parentPoint.x,
              y: ref.current.y - parentPoint.y,
            };
          }
        }
      }}
      onGlobalPointerMove={(event: FederatedPointerEvent) => {
        if (!dragging.current || !editable) return;
        const parentPoint = ref.current?.parent?.toLocal(event.global);
        if (!parentPoint || !ref.current) return;
        moved.current = true;
        ref.current.position.set(
          Math.max(
            0,
            Math.min(worldWidth, parentPoint.x + dragOffset.current.x),
          ),
          Math.max(
            0,
            Math.min(worldHeight, parentPoint.y + dragOffset.current.y),
          ),
        );
      }}
      onPointerUp={(event: FederatedPointerEvent) => {
        event.stopPropagation();
        if (dragging.current && moved.current && ref.current) {
          onMove(
            node.id,
            Math.round((ref.current.x / worldWidth) * 1000) / 10,
            Math.round((ref.current.y / worldHeight) * 1000) / 10,
          );
        } else {
          onSelect(node.id);
          if (!editable) onOpen(node.id);
        }
        dragging.current = false;
      }}
      onPointerUpOutside={() => {
        dragging.current = false;
      }}
    >
      <pixiGraphics draw={drawGlow} />
      {texture && (
        <pixiSprite
          texture={texture}
          anchor={{ x: 0.5, y: 1 }}
          width={node.width}
          height={node.height}
          y={!editable && hovered ? -10 : 0}
        />
      )}
    </pixiContainer>
  );
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
        if (active) setTexture(loaded as Texture);
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
