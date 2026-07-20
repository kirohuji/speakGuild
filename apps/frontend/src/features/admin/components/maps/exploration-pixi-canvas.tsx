import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

extend({ Container, Graphics, Sprite });

export type ExplorationNode = {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  disabled?: boolean;
  hidden?: boolean;
};

interface ExplorationPixiCanvasProps {
  backgroundUrl?: string | null;
  nodes: ExplorationNode[];
  selectedId?: string;
  editable: boolean;
  emptyLabel: string;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
}

const WORLD_WIDTH = 1600;
const WORLD_HEIGHT = 900;

export function ExplorationPixiCanvas(props: ExplorationPixiCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 960, height: 620 });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const update = () =>
      setSize({
        width: Math.max(480, host.clientWidth),
        height: Math.max(420, host.clientHeight),
      });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={hostRef}
      className="relative h-[min(720px,72vh)] min-h-[520px] overflow-hidden rounded-2xl border bg-[#111722] shadow-inner"
    >
      <Application
        resizeTo={hostRef as React.RefObject<HTMLElement>}
        background={0x111722}
        antialias
        autoDensity
        resolution={Math.min(window.devicePixelRatio || 1, 2)}
      >
        <ExplorationStage
          {...props}
          viewportWidth={size.width}
          viewportHeight={size.height}
        />
      </Application>
    </div>
  );
}

function ExplorationStage({
  backgroundUrl,
  nodes,
  selectedId,
  editable,
  emptyLabel,
  onSelect,
  onOpen,
  onMove,
  viewportWidth,
  viewportHeight,
}: ExplorationPixiCanvasProps & {
  viewportWidth: number;
  viewportHeight: number;
}) {
  const worldRef = useRef<Container>(null);
  const background = useTexture(backgroundUrl);
  const scale = Math.min(
    viewportWidth / WORLD_WIDTH,
    viewportHeight / WORLD_HEIGHT,
  );
  const offsetX = (viewportWidth - WORLD_WIDTH * scale) / 2;
  const offsetY = (viewportHeight - WORLD_HEIGHT * scale) / 2;

  const drawFrame = useCallback(
    (g: PixiGraphics) => {
      g.clear()
        .roundRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT, 24)
        .fill({ color: 0x182131 })
        .stroke({ color: 0xffffff, alpha: 0.08, width: 2 / scale });
    },
    [scale],
  );

  useEffect(() => {
    const world = worldRef.current;
    if (!world) return;
    const messages: PixiText[] = [];
    if (!backgroundUrl) {
      const empty = new PixiText({
        text: emptyLabel,
        style: {
          fontFamily: "sans-serif",
          fontSize: 28,
          align: "center",
          fill: 0x94a3b8,
        },
      });
      empty.anchor.set(0.5);
      empty.position.set(WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
      world.addChild(empty);
      messages.push(empty);
    }
    const hint = new PixiText({
      text: editable
        ? "拖动图片热点调整位置  ·  双击进入"
        : "预览模式  ·  点击热点查看",
      style: { fontFamily: "sans-serif", fontSize: 17, fill: 0xcbd5e1 },
    });
    hint.position.set(28, WORLD_HEIGHT - 42);
    world.addChild(hint);
    messages.push(hint);
    return () => messages.forEach((message) => message.destroy());
  }, [backgroundUrl, editable, emptyLabel]);

  return (
    <pixiContainer ref={worldRef} x={offsetX} y={offsetY} scale={scale}>
      <pixiGraphics draw={drawFrame} />
      {background && (
        <pixiSprite
          texture={background}
          width={WORLD_WIDTH}
          height={WORLD_HEIGHT}
        />
      )}
      <pixiGraphics
        draw={(g: PixiGraphics) =>
          g
            .clear()
            .rect(0, 0, WORLD_WIDTH, WORLD_HEIGHT)
            .fill({ color: 0x020617, alpha: background ? 0.08 : 0 })
        }
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
  onSelect,
  onOpen,
  onMove,
}: {
  node: ExplorationNode;
  selected: boolean;
  editable: boolean;
  viewportScale: number;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
}) {
  const ref = useRef<Container>(null);
  const texture = useTexture(node.imageUrl);
  const [hovered, setHovered] = useState(false);
  const dragging = useRef(false);
  const lastTap = useRef(0);

  useTick((ticker) => {
    if (!ref.current) return;
    const pulse =
      selected || hovered ? 1 + Math.sin(performance.now() / 230) * 0.025 : 1;
    ref.current.scale.set(pulse);
  });

  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    const title = new PixiText({
      text: node.title,
      style: {
        fontFamily: "sans-serif",
        fontSize: 22,
        fontWeight: "600",
        fill: 0xffffff,
        stroke: { color: 0x0f172a, width: 5 },
      },
    });
    title.anchor.set(0.5, 0);
    title.position.set(0, node.height / 2 + 14);
    container.addChild(title);
    let subtitle: PixiText | null = null;
    if (node.subtitle) {
      subtitle = new PixiText({
        text: node.subtitle,
        style: {
          fontFamily: "sans-serif",
          fontSize: 14,
          fill: 0xcbd5e1,
          stroke: { color: 0x0f172a, width: 4 },
        },
      });
      subtitle.anchor.set(0.5, 0);
      subtitle.position.set(0, node.height / 2 + 42);
      container.addChild(subtitle);
    }
    return () => {
      title.destroy();
      subtitle?.destroy();
    };
  }, [node.height, node.subtitle, node.title]);

  const drawGlow = useCallback(
    (g: PixiGraphics) => {
      g.clear();
      const active = selected || hovered;
      if (active)
        g.roundRect(
          -node.width / 2 - 10,
          -node.height / 2 - 10,
          node.width + 20,
          node.height + 20,
          22,
        )
          .fill({ color: 0xfbbf24, alpha: selected ? 0.22 : 0.13 })
          .stroke({ color: 0xfde68a, alpha: 0.95, width: 3 / viewportScale });
      if (!texture)
        g.roundRect(
          -node.width / 2,
          -node.height / 2,
          node.width,
          node.height,
          18,
        )
          .fill({ color: node.disabled ? 0x475569 : 0x2563eb, alpha: 0.88 })
          .stroke({ color: 0xffffff, alpha: 0.65, width: 2 / viewportScale });
    },
    [
      hovered,
      node.disabled,
      node.height,
      node.width,
      selected,
      texture,
      viewportScale,
    ],
  );

  return (
    <pixiContainer
      ref={ref}
      x={(node.x / 100) * WORLD_WIDTH}
      y={(node.y / 100) * WORLD_HEIGHT}
      alpha={node.disabled ? 0.55 : 1}
      eventMode="static"
      cursor={editable ? "grab" : "pointer"}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
      onPointerDown={() => {
        if (editable) dragging.current = true;
      }}
      onPointerMove={(event: FederatedPointerEvent) => {
        if (!dragging.current || !editable) return;
        const parentPoint = ref.current?.parent?.toLocal(event.global);
        if (!parentPoint || !ref.current) return;
        ref.current.position.set(
          Math.max(0, Math.min(WORLD_WIDTH, parentPoint.x)),
          Math.max(0, Math.min(WORLD_HEIGHT, parentPoint.y)),
        );
      }}
      onPointerUp={() => {
        if (dragging.current && ref.current)
          onMove(
            node.id,
            Math.round((ref.current.x / WORLD_WIDTH) * 1000) / 10,
            Math.round((ref.current.y / WORLD_HEIGHT) * 1000) / 10,
          );
        dragging.current = false;
      }}
      onPointerUpOutside={() => {
        dragging.current = false;
      }}
      onPointerTap={() => {
        onSelect(node.id);
        const now = Date.now();
        if (now - lastTap.current < 360) onOpen(node.id);
        lastTap.current = now;
      }}
    >
      <pixiGraphics draw={drawGlow} />
      {texture && (
        <pixiSprite
          texture={texture}
          anchor={0.5}
          width={node.width}
          height={node.height}
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
