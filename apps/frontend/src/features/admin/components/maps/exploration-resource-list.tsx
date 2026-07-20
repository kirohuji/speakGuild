import { DoorOpen, MapPin } from "lucide-react";
import { cn } from "@/lib/cn";
import type { GameLocationData, GameRoomData } from "../../api-content-admin";
import type { ExplorationEditorLevel } from "./exploration-editor-toolbar";

export function ExplorationResourceList({
  level,
  locations,
  rooms,
  selectedId,
  onSelect,
  onOpen,
}: {
  level: ExplorationEditorLevel;
  locations: GameLocationData[];
  rooms: GameRoomData[];
  selectedId: string;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  const items = level === "world" ? locations : rooms;
  return (
    <aside className="min-w-0 rounded-xl border bg-card p-3">
      <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {level === "world" ? "地点" : "房间"}
      </p>
      <div className="space-y-1">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={cn(
              "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
              item.id === selectedId
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted",
            )}
            onClick={() => onSelect(item.id)}
            onDoubleClick={() => onOpen(item.id)}
          >
            {level === "world" ? (
              <MapPin className="size-4 shrink-0" />
            ) : (
              <DoorOpen className="size-4 shrink-0" />
            )}
            <span className="min-w-0 flex-1 truncate">{item.displayName}</span>
          </button>
        ))}
      </div>
      {!items.length && (
        <p className="px-2 py-10 text-center text-xs text-muted-foreground">
          还没有{level === "world" ? "地点" : "房间"}
        </p>
      )}
    </aside>
  );
}
