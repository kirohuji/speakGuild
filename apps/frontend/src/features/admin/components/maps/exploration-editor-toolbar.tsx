import { ArrowLeft, Eye, Plus, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectItem } from "@/components/ui/select";
import type { GameLocationData, GameMapData } from "../../api-content-admin";

export type ExplorationEditorLevel = "world" | "location";

export function ExplorationEditorToolbar({
  maps,
  mapId,
  level,
  selectedMap,
  selectedLocation,
  editable,
  onMapChange,
  onCreateMap,
  onBack,
  onToggleMode,
  onCreateNode,
}: {
  maps: GameMapData[];
  mapId: string;
  level: ExplorationEditorLevel;
  selectedMap: GameMapData | null;
  selectedLocation: GameLocationData | null;
  editable: boolean;
  onMapChange: (id: string) => void;
  onCreateMap: () => void;
  onBack: () => void;
  onToggleMode: () => void;
  onCreateNode: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3">
      <Select
        value={mapId}
        onChange={(event) => onMapChange(event.target.value)}
        className="w-[220px]"
      >
        {maps.map((item) => (
          <SelectItem key={item.id} value={item.id}>
            {item.displayName}
          </SelectItem>
        ))}
      </Select>
      <Button variant="outline" size="sm" onClick={onCreateMap}>
        <Plus className="mr-1 size-4" />
        新建地图
      </Button>
      <div className="mx-1 h-6 w-px bg-border" />
      {level === "location" && (
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-1 size-4" />
          世界地图
        </Button>
      )}
      <div className="min-w-0 flex-1 text-sm">
        <span className="font-semibold">{selectedMap?.displayName}</span>
        {level === "location" && selectedLocation && (
          <>
            <span className="mx-2 text-muted-foreground">/</span>
            <span>{selectedLocation.displayName}</span>
          </>
        )}
      </div>
      <Button
        variant={editable ? "default" : "outline"}
        size="sm"
        onClick={onToggleMode}
      >
        {editable ? (
          <Wrench className="mr-1 size-4" />
        ) : (
          <Eye className="mr-1 size-4" />
        )}
        {editable ? "编辑位置" : "预览交互"}
      </Button>
      <Button variant="outline" size="sm" onClick={onCreateNode}>
        <Plus className="mr-1 size-4" />
        {level === "world" ? "添加地点" : "添加房间"}
      </Button>
    </div>
  );
}
