import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ImageUploadField } from './image-upload-field'
import { NQTR_COMMANDS, parseNqtrChrome, type NqtrChrome, type NqtrCommandKey } from './maps/nqtr-model'

export function NqtrPackageChrome({
  chrome,
  saving,
  onChange,
  onSave,
}: {
  chrome: NqtrChrome
  saving: boolean
  onChange: (chrome: NqtrChrome) => void
  onSave: () => void
}) {
  const look = parseNqtrChrome(chrome)
  const setCommand = (key: NqtrCommandKey, patch: Partial<NqtrChrome['commands'][NqtrCommandKey]>) => {
    onChange({ ...look, commands: { ...look.commands, [key]: { ...look.commands[key], ...patch } } })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>外观</CardTitle>
        <CardDescription>给画面图标、时间地点牌、地图/热点名牌配图。上面那排文字按钮不用配。行为图标仍可用各自资源，这里只改默认图和大小。</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-8">
        {NQTR_COMMANDS.map((item, index) => (
          <section key={item.key} className="flex flex-col gap-4">
            {index > 0 && <Separator />}
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-semibold">{item.label}</h3>
              <p className="text-xs text-muted-foreground">{item.hint}</p>
            </div>
            <div className="grid items-start gap-6 sm:grid-cols-[minmax(0,1fr)_180px]">
              <div className="flex flex-col gap-2">
                <Label>图标</Label>
                <ImageUploadField
                  value={look.commands[item.key].icon}
                  onChange={(icon) => setCommand(item.key, { icon })}
                  placeholder={`上传${item.label}图标`}
                  previewSize="sm"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor={`${item.key}-size`}>大小</Label>
                <Input
                  id={`${item.key}-size`}
                  type="number"
                  min={16}
                  value={look.commands[item.key].size}
                  onChange={(event) => {
                    const number = Number(event.target.value)
                    setCommand(item.key, { size: Number.isFinite(number) ? number : look.commands[item.key].size })
                  }}
                />
                <p className="text-xs text-muted-foreground">像素，最小 16</p>
              </div>
            </div>
          </section>
        ))}

        <Separator />

        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold">地点与热点名牌</h3>
            <p className="text-xs text-muted-foreground">大地图上的地点，以及点开「热点」后的房间/互动点。底板用这张图，黑字居中；文字越长，底板会略微拉宽。</p>
          </div>
          <div className="grid items-start gap-6 sm:grid-cols-[minmax(0,1fr)_180px]">
            <div className="flex flex-col gap-2">
              <Label>底板图</Label>
              <ImageUploadField
                value={look.pinLabelIcon}
                onChange={(pinLabelIcon) => onChange({ ...look, pinLabelIcon, hotspotIcon: pinLabelIcon })}
                placeholder="上传地点/热点名牌底板"
                previewSize="sm"
              />
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="pin-label-height">高</Label>
                <Input
                  id="pin-label-height"
                  type="number"
                  min={16}
                  value={look.pinLabelHeight}
                  onChange={(event) => onChange({ ...look, pinLabelHeight: Number(event.target.value) || look.pinLabelHeight })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="pin-label-min-width">最小宽</Label>
                <Input
                  id="pin-label-min-width"
                  type="number"
                  min={16}
                  value={look.pinLabelMinWidth}
                  onChange={(event) => onChange({ ...look, pinLabelMinWidth: Number(event.target.value) || look.pinLabelMinWidth })}
                />
                <p className="text-xs text-muted-foreground">像素；实际宽度随文字变长</p>
              </div>
            </div>
          </div>
        </section>

        <Separator />

        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold">行为</h3>
            <p className="text-xs text-muted-foreground">房间底部可以点的行为。某个行为自己有图时用它自己的，没有就用这里的图。</p>
          </div>
          <div className="grid items-start gap-6 sm:grid-cols-[minmax(0,1fr)_180px]">
            <div className="flex flex-col gap-2">
              <Label>图标</Label>
              <ImageUploadField value={look.activityIcon} onChange={(activityIcon) => onChange({ ...look, activityIcon })} placeholder="上传行为图标" previewSize="sm" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="activity-size">大小</Label>
              <Input id="activity-size" type="number" min={16} value={look.activityIconSize} onChange={(event) => onChange({ ...look, activityIconSize: Number(event.target.value) || look.activityIconSize })} />
              <p className="text-xs text-muted-foreground">像素，最小 16</p>
            </div>
          </div>
        </section>

        <Separator />

        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold">对话</h3>
            <p className="text-xs text-muted-foreground">房间右下角。点开后列出当前可以手动搭话的角色。到点自动出现的角色仍站在画面上。</p>
          </div>
          <div className="grid items-start gap-6 sm:grid-cols-[minmax(0,1fr)_180px]">
            <div className="flex flex-col gap-2">
              <Label>图标</Label>
              <ImageUploadField value={look.talkIcon} onChange={(talkIcon) => onChange({ ...look, talkIcon })} placeholder="上传对话图标" previewSize="sm" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="talk-size">大小</Label>
              <Input id="talk-size" type="number" min={16} value={look.talkIconSize} onChange={(event) => onChange({ ...look, talkIconSize: Number(event.target.value) || look.talkIconSize })} />
              <p className="text-xs text-muted-foreground">像素，最小 16</p>
            </div>
          </div>
        </section>

        <Separator />

        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold">时间地点牌</h3>
            <p className="text-xs text-muted-foreground">房间和 VN 对话左上角。底板用这里的图，文字居中：第一行时间，第二行地点。</p>
          </div>
          <div className="grid items-start gap-6 sm:grid-cols-[minmax(0,1fr)_180px]">
            <div className="flex flex-col gap-2">
              <Label>底板图</Label>
              <ImageUploadField
                value={look.statusBadgeIcon}
                onChange={(statusBadgeIcon) => onChange({ ...look, statusBadgeIcon })}
                placeholder="上传时间地点底板"
                previewSize="sm"
              />
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="status-badge-width">宽</Label>
                <Input
                  id="status-badge-width"
                  type="number"
                  min={16}
                  value={look.statusBadgeWidth}
                  onChange={(event) => onChange({ ...look, statusBadgeWidth: Number(event.target.value) || look.statusBadgeWidth })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="status-badge-height">高</Label>
                <Input
                  id="status-badge-height"
                  type="number"
                  min={16}
                  value={look.statusBadgeHeight}
                  onChange={(event) => onChange({ ...look, statusBadgeHeight: Number(event.target.value) || look.statusBadgeHeight })}
                />
                <p className="text-xs text-muted-foreground">像素，最小 16</p>
              </div>
            </div>
          </div>
        </section>

        <Button className="w-fit" disabled={saving} onClick={onSave}>{saving ? '保存中…' : '保存外观'}</Button>
      </CardContent>
    </Card>
  )
}
