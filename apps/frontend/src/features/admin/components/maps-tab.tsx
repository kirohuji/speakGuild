import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DoorOpen,
  Edit3,
  Home,
  Map,
  MapPin,
  Plus,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectItem } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  addRoomNpc,
  createLocation,
  createMap,
  createRoom,
  deleteLocation,
  deleteMap,
  deleteRoom,
  listCharacters,
  listLocations,
  listMaps,
  listRooms,
  removeRoomNpc,
  updateLocation,
  updateMap,
  updateRoom,
  type GameCharacter,
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
  ExplorationEditorToolbar,
  type ExplorationEditorLevel,
} from "./maps/exploration-editor-toolbar";
import { ExplorationResourceList } from "./maps/exploration-resource-list";
import { ExplorationInspector } from "./maps/exploration-inspector";
import {
  getRoomLayout,
  makeExplorationKey,
  updateRoomLayout,
} from "./maps/exploration-map-model";

interface MapsTabProps {
  onLocationsChange?: (locations: GameLocationData[]) => void;
}

export function MapsTab({ onLocationsChange }: MapsTabProps) {
  const [maps, setMaps] = useState<GameMapData[]>([]);
  const [locations, setLocations] = useState<GameLocationData[]>([]);
  const [rooms, setRooms] = useState<GameRoomData[]>([]);
  const [characters, setCharacters] = useState<GameCharacter[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapId, setMapId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [level, setLevel] = useState<ExplorationEditorLevel>("world");
  const [editable, setEditable] = useState(true);
  const [saving, setSaving] = useState(false);

  const [mapDialog, setMapDialog] = useState(false);
  const [editingMap, setEditingMap] = useState<GameMapData | null>(null);
  const [mapForm, setMapForm] = useState({
    displayName: "",
    backgroundUrl: "",
    thumbnailUrl: "",
    width: 1920,
    height: 1080,
  });
  const [locationDialog, setLocationDialog] = useState(false);
  const [editingLocation, setEditingLocation] =
    useState<GameLocationData | null>(null);
  const [locationForm, setLocationForm] = useState({
    displayName: "",
    description: "",
    icon: "",
    backgroundUrl: "",
    locationType: "building",
  });
  const [roomDialog, setRoomDialog] = useState(false);
  const [editingRoom, setEditingRoom] = useState<GameRoomData | null>(null);
  const [roomForm, setRoomForm] = useState({
    displayName: "",
    description: "",
    icon: "",
    backgroundUrl: "",
    roomType: "vn_scene",
    inkScriptId: "",
    isEntrance: false,
  });
  const [npcDialog, setNpcDialog] = useState(false);
  const [npcCharacterId, setNpcCharacterId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextMaps, nextLocations, nextRooms, nextCharacters] =
        await Promise.all([
          listMaps(),
          listLocations(),
          listRooms(),
          listCharacters(),
        ]);
      setMaps(nextMaps);
      setLocations(nextLocations);
      setRooms(nextRooms);
      setCharacters(nextCharacters);
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
    () => rooms.filter((item) => item.locationId === selectedLocation?.id),
    [rooms, selectedLocation?.id],
  );
  const selectedRoom = locationRooms.find((item) => item.id === roomId) ?? null;

  useEffect(() => {
    if (locationId && !mapLocations.some((item) => item.id === locationId))
      setLocationId("");
  }, [locationId, mapLocations]);

  const worldNodes: ExplorationNode[] = mapLocations.map((location) => ({
    id: location.id,
    title: location.displayName,
    subtitle: `${rooms.filter((room) => room.locationId === location.id).length} 个房间`,
    imageUrl: location.icon,
    x: location.posX || 50,
    y: location.posY || 50,
    width: Math.max(70, location.iconWidth ?? 120),
    height: Math.max(70, location.iconHeight ?? 100),
    disabled: location.disabled,
    hidden: location.hidden,
  }));
  const roomNodes: ExplorationNode[] = locationRooms.map((room, index) => {
    const layout = getRoomLayout(
      selectedMap,
      selectedLocation?.id ?? "",
      room.id,
      index,
    );
    return {
      id: room.id,
      title: room.displayName,
      subtitle: room.isEntrance ? "入口" : room.roomType,
      imageUrl: room.icon,
      ...layout,
      disabled: room.disabled,
      hidden: room.hidden,
    };
  });

  const enterLocation = (id: string) => {
    setLocationId(id);
    setRoomId("");
    setLevel("location");
  };
  const moveLocation = async (id: string, x: number, y: number) => {
    setLocations((items) =>
      items.map((item) =>
        item.id === id ? { ...item, posX: x, posY: y } : item,
      ),
    );
    try {
      await updateLocation(id, { posX: x, posY: y });
    } catch {
      toast.error("地点位置保存失败");
      await load();
    }
  };
  const moveRoom = async (id: string, x: number, y: number) => {
    if (!selectedMap || !selectedLocation) return;
    const previous = selectedMap.editorData ?? {};
    const currentLayout = getRoomLayout(
      selectedMap,
      selectedLocation.id,
      id,
      locationRooms.findIndex((item) => item.id === id),
    );
    const editorData = updateRoomLayout(previous, selectedLocation.id, id, {
      ...currentLayout,
      x,
      y,
    });
    setMaps((items) =>
      items.map((item) =>
        item.id === selectedMap.id ? { ...item, editorData } : item,
      ),
    );
    try {
      await updateMap(selectedMap.id, { editorData });
    } catch {
      toast.error("房间热点位置保存失败");
      await load();
    }
  };

  const openMap = (map?: GameMapData) => {
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
  const removeMap = async () => {
    if (
      !selectedMap ||
      !confirm(`删除地图“${selectedMap.displayName}”及其地点？`)
    )
      return;
    try {
      await deleteMap(selectedMap.id);
      setMapId("");
      setLevel("world");
      await load();
    } catch {
      toast.error("地图删除失败");
    }
  };

  const openLocation = (location?: GameLocationData) => {
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
          posY: 50,
          iconWidth: 140,
          iconHeight: 100,
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
  const removeLocation = async () => {
    if (
      !selectedLocation ||
      !confirm(`删除地点“${selectedLocation.displayName}”及其房间？`)
    )
      return;
    try {
      await deleteLocation(selectedLocation.id);
      setLocationId("");
      setLevel("world");
      await load();
    } catch {
      toast.error("地点删除失败");
    }
  };

  const openRoom = (room?: GameRoomData) => {
    setEditingRoom(room ?? null);
    setRoomForm({
      displayName: room?.displayName ?? "",
      description: room?.description ?? "",
      icon: room?.icon ?? "",
      backgroundUrl: room?.backgroundUrl ?? "",
      roomType: room?.roomType ?? "vn_scene",
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
  const removeRoom = async () => {
    if (!selectedRoom || !confirm(`删除房间“${selectedRoom.displayName}”？`))
      return;
    try {
      await deleteRoom(selectedRoom.id);
      setRoomId("");
      await load();
    } catch {
      toast.error("房间删除失败");
    }
  };
  const addNpc = async () => {
    if (!selectedRoom || !npcCharacterId) return;
    setSaving(true);
    try {
      await addRoomNpc({
        roomId: selectedRoom.id,
        characterId: npcCharacterId,
      });
      setNpcDialog(false);
      await load();
    } catch {
      toast.error("NPC 添加失败");
    } finally {
      setSaving(false);
    }
  };
  const removeNpc = async (id: string) => {
    try {
      await removeRoomNpc(id);
      await load();
    } catch {
      toast.error("NPC 移除失败");
    }
  };

  if (loading)
    return (
      <div className="py-20 text-center text-sm text-muted-foreground">
        正在加载地图世界…
      </div>
    );
  if (!maps.length)
    return (
      <div className="rounded-2xl border border-dashed py-20 text-center">
        <Map className="mx-auto size-10 text-muted-foreground/30" />
        <h3 className="mt-4 font-semibold">创建第一个探索地图</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          上传世界底图，然后把地点图片放到地图上。
        </p>
        <Button className="mt-5" onClick={() => openMap()}>
          <Plus className="mr-1.5 size-4" />
          新建地图
        </Button>
      </div>
    );

  return (
    <div className="space-y-4">
      <ExplorationEditorToolbar
        maps={maps}
        mapId={mapId}
        level={level}
        selectedMap={selectedMap}
        selectedLocation={selectedLocation}
        editable={editable}
        onMapChange={(id) => {
          setMapId(id);
          setLocationId("");
          setRoomId("");
          setLevel("world");
        }}
        onCreateMap={() => openMap()}
        onBack={() => {
          setLevel("world");
          setRoomId("");
        }}
        onToggleMode={() => setEditable((value) => !value)}
        onCreateNode={() => (level === "world" ? openLocation() : openRoom())}
      />

      <div className="grid min-w-0 gap-4 xl:grid-cols-[210px_minmax(0,1fr)_270px]">
        <ExplorationResourceList
          level={level}
          locations={mapLocations}
          rooms={locationRooms}
          selectedId={level === "world" ? locationId : roomId}
          onSelect={(id) =>
            level === "world" ? setLocationId(id) : setRoomId(id)
          }
          onOpen={(id) =>
            level === "world" ? enterLocation(id) : setRoomId(id)
          }
        />

        <main className="min-w-0">
          <ExplorationPixiCanvas
            backgroundUrl={
              level === "world"
                ? selectedMap?.backgroundUrl
                : selectedLocation?.backgroundUrl
            }
            nodes={level === "world" ? worldNodes : roomNodes}
            selectedId={level === "world" ? locationId : roomId}
            editable={editable}
            emptyLabel={
              level === "world"
                ? "请先为地图上传底图"
                : "请先为地点上传场景背景"
            }
            onSelect={(id) =>
              level === "world" ? setLocationId(id) : setRoomId(id)
            }
            onOpen={(id) =>
              level === "world" ? enterLocation(id) : setRoomId(id)
            }
            onMove={level === "world" ? moveLocation : moveRoom}
          />
        </main>

        <aside className="min-w-0 space-y-3">
          {level === "world" && !selectedLocation && (
            <ExplorationInspector
              title={selectedMap?.displayName ?? ""}
              icon={<Map className="size-4" />}
            >
              <p>
                {mapLocations.length} 个地点 ·{" "}
                {
                  rooms.filter((room) =>
                    mapLocations.some((loc) => loc.id === room.locationId),
                  ).length
                }{" "}
                个房间
              </p>
              <Button
                className="w-full"
                variant="outline"
                onClick={() => selectedMap && openMap(selectedMap)}
              >
                <Edit3 className="mr-1 size-4" />
                编辑地图与底图
              </Button>
              <Button className="w-full" variant="ghost" onClick={removeMap}>
                <Trash2 className="mr-1 size-4 text-destructive" />
                删除地图
              </Button>
            </ExplorationInspector>
          )}
          {level === "world" && selectedLocation && (
            <ExplorationInspector
              title={selectedLocation.displayName}
              icon={<MapPin className="size-4" />}
              image={selectedLocation.icon}
            >
              <p>{selectedLocation.description || "暂无地点说明"}</p>
              <div className="flex gap-2">
                <Badge variant="secondary">
                  {selectedLocation.locationType}
                </Badge>
                <Badge variant="outline">
                  {
                    rooms.filter(
                      (room) => room.locationId === selectedLocation.id,
                    ).length
                  }{" "}
                  个房间
                </Badge>
              </div>
              <Button
                className="w-full"
                onClick={() => enterLocation(selectedLocation.id)}
              >
                <Sparkles className="mr-1 size-4" />
                进入场景编辑
              </Button>
              <Button
                className="w-full"
                variant="outline"
                onClick={() => openLocation(selectedLocation)}
              >
                <Edit3 className="mr-1 size-4" />
                编辑地点图片
              </Button>
              <Button
                className="w-full"
                variant="ghost"
                onClick={removeLocation}
              >
                <Trash2 className="mr-1 size-4 text-destructive" />
                删除地点
              </Button>
            </ExplorationInspector>
          )}
          {level === "location" && selectedLocation && !selectedRoom && (
            <ExplorationInspector
              title={selectedLocation.displayName}
              icon={<Home className="size-4" />}
              image={selectedLocation.backgroundUrl}
            >
              <p>这是地点场景。将房间图片放置在背景中的可点击位置。</p>
              <Button
                className="w-full"
                variant="outline"
                onClick={() => openLocation(selectedLocation)}
              >
                <Edit3 className="mr-1 size-4" />
                更换场景背景
              </Button>
            </ExplorationInspector>
          )}
          {level === "location" && selectedRoom && (
            <ExplorationInspector
              title={selectedRoom.displayName}
              icon={<DoorOpen className="size-4" />}
              image={selectedRoom.icon}
            >
              <p>{selectedRoom.description || "暂无房间说明"}</p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{selectedRoom.roomType}</Badge>
                {selectedRoom.isEntrance && <Badge>入口</Badge>}
                {selectedRoom.inkScriptId && (
                  <Badge variant="outline">已关联剧情</Badge>
                )}
              </div>
              <Button
                className="w-full"
                variant="outline"
                onClick={() => openRoom(selectedRoom)}
              >
                <Edit3 className="mr-1 size-4" />
                编辑房间
              </Button>
              <div className="rounded-lg border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold">场景 NPC</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setNpcCharacterId("");
                      setNpcDialog(true);
                    }}
                  >
                    <Plus className="size-3.5" />
                  </Button>
                </div>
                {selectedRoom.npcs?.map((npc) => (
                  <div
                    key={npc.id}
                    className="flex items-center gap-2 py-1.5 text-xs"
                  >
                    <Users className="size-3.5" />
                    <span className="min-w-0 flex-1 truncate">
                      {npc.character.displayName}
                    </span>
                    <button
                      aria-label="移除 NPC"
                      onClick={() => void removeNpc(npc.id)}
                    >
                      <Trash2 className="size-3 text-destructive" />
                    </button>
                  </div>
                ))}
                {!selectedRoom.npcs?.length && (
                  <p className="text-xs text-muted-foreground">尚未放置 NPC</p>
                )}
              </div>
              <Button className="w-full" variant="ghost" onClick={removeRoom}>
                <Trash2 className="mr-1 size-4 text-destructive" />
                删除房间
              </Button>
            </ExplorationInspector>
          )}
        </aside>
      </div>

      <Dialog open={mapDialog} onOpenChange={setMapDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingMap ? "编辑地图" : "新建地图"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>地图名称</Label>
              <Input
                value={mapForm.displayName}
                onChange={(e) =>
                  setMapForm({ ...mapForm, displayName: e.target.value })
                }
                placeholder="例如：漫语町…"
              />
            </div>
            <div>
              <Label>世界地图底图</Label>
              <ImageUploadField
                value={mapForm.backgroundUrl}
                onChange={(url) =>
                  setMapForm({ ...mapForm, backgroundUrl: url })
                }
                previewSize="lg"
                group="library"
              />
            </div>
            <div>
              <Label>列表缩略图</Label>
              <ImageUploadField
                value={mapForm.thumbnailUrl}
                onChange={(url) =>
                  setMapForm({ ...mapForm, thumbnailUrl: url })
                }
                previewSize="sm"
                group="library"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMapDialog(false)}>
              取消
            </Button>
            <Button
              onClick={() => void saveMap()}
              disabled={saving || !mapForm.displayName.trim()}
            >
              保存地图
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={locationDialog} onOpenChange={setLocationDialog}>
        <DialogContent className="max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingLocation ? "编辑地点" : "添加地点"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>地点名称</Label>
              <Input
                value={locationForm.displayName}
                onChange={(e) =>
                  setLocationForm({
                    ...locationForm,
                    displayName: e.target.value,
                  })
                }
                placeholder="例如：车站…"
              />
            </div>
            <div>
              <Label>地点说明</Label>
              <Textarea
                value={locationForm.description}
                onChange={(e) =>
                  setLocationForm({
                    ...locationForm,
                    description: e.target.value,
                  })
                }
              />
            </div>
            <div>
              <Label>地点类型</Label>
              <Select
                value={locationForm.locationType}
                onChange={(e) =>
                  setLocationForm({
                    ...locationForm,
                    locationType: e.target.value,
                  })
                }
              >
                <SelectItem value="building">建筑</SelectItem>
                <SelectItem value="outdoor">户外</SelectItem>
                <SelectItem value="district">街区</SelectItem>
              </Select>
            </div>
            <div>
              <Label>地图上的地点图片</Label>
              <ImageUploadField
                value={locationForm.icon}
                onChange={(url) =>
                  setLocationForm({ ...locationForm, icon: url })
                }
                previewSize="md"
                group="library"
              />
            </div>
            <div>
              <Label>进入后的场景背景</Label>
              <ImageUploadField
                value={locationForm.backgroundUrl}
                onChange={(url) =>
                  setLocationForm({ ...locationForm, backgroundUrl: url })
                }
                previewSize="lg"
                group="library"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLocationDialog(false)}>
              取消
            </Button>
            <Button
              onClick={() => void saveLocation()}
              disabled={saving || !locationForm.displayName.trim()}
            >
              保存地点
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={roomDialog} onOpenChange={setRoomDialog}>
        <DialogContent className="max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRoom ? "编辑房间" : "添加房间"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>房间名称</Label>
              <Input
                value={roomForm.displayName}
                onChange={(e) =>
                  setRoomForm({ ...roomForm, displayName: e.target.value })
                }
                placeholder="例如：咖啡店入口…"
              />
            </div>
            <div>
              <Label>房间说明</Label>
              <Textarea
                value={roomForm.description}
                onChange={(e) =>
                  setRoomForm({ ...roomForm, description: e.target.value })
                }
              />
            </div>
            <div>
              <Label>场景类型</Label>
              <Select
                value={roomForm.roomType}
                onChange={(e) =>
                  setRoomForm({ ...roomForm, roomType: e.target.value })
                }
              >
                <SelectItem value="vn_scene">VN 场景</SelectItem>
                <SelectItem value="hub">枢纽</SelectItem>
                <SelectItem value="shop">商店</SelectItem>
                <SelectItem value="quest">任务点</SelectItem>
              </Select>
            </div>
            <div>
              <Label>场景中的可点击图片</Label>
              <ImageUploadField
                value={roomForm.icon}
                onChange={(url) => setRoomForm({ ...roomForm, icon: url })}
                previewSize="md"
                group="library"
              />
            </div>
            <div>
              <Label>进入房间后的 VN 背景</Label>
              <ImageUploadField
                value={roomForm.backgroundUrl}
                onChange={(url) =>
                  setRoomForm({ ...roomForm, backgroundUrl: url })
                }
                previewSize="lg"
                group="library"
              />
            </div>
            <div>
              <Label>关联 Ink 剧情 ID</Label>
              <Input
                value={roomForm.inkScriptId}
                onChange={(e) =>
                  setRoomForm({ ...roomForm, inkScriptId: e.target.value })
                }
                placeholder="可选…"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={roomForm.isEntrance}
                onChange={(e) =>
                  setRoomForm({ ...roomForm, isEntrance: e.target.checked })
                }
              />
              设为地点入口
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoomDialog(false)}>
              取消
            </Button>
            <Button
              onClick={() => void saveRoom()}
              disabled={saving || !roomForm.displayName.trim()}
            >
              保存房间
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={npcDialog} onOpenChange={setNpcDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>放置 NPC</DialogTitle>
          </DialogHeader>
          <div>
            <Label>选择全局角色</Label>
            <Select
              value={npcCharacterId}
              onChange={(e) => setNpcCharacterId(e.target.value)}
            >
              <option value="">选择角色</option>
              {characters
                .filter(
                  (character) =>
                    !selectedRoom?.npcs?.some(
                      (npc) => npc.character.id === character.id,
                    ),
                )
                .map((character) => (
                  <option key={character.id} value={character.id}>
                    {character.displayName}
                  </option>
                ))}
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNpcDialog(false)}>
              取消
            </Button>
            <Button
              onClick={() => void addNpc()}
              disabled={saving || !npcCharacterId}
            >
              添加 NPC
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
