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
        <CardDescription>只给画面上的图标配图。上面那排文字按钮不用配。热点和行为的图仍用各自的资源，这里只改大小。</CardDescription>
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
            <h3 className="text-sm font-semibold">热点标记</h3>
            <p className="text-xs text-muted-foreground">点右上角「热点」之后，出现在地点上的房间和互动。某个热点自己有图时用它自己的，没有就用这里的图。</p>
          </div>
          <div className="grid items-start gap-6 sm:grid-cols-[minmax(0,1fr)_180px]">
            <div className="flex flex-col gap-2">
              <Label>图标</Label>
              <ImageUploadField value={look.hotspotIcon} onChange={(hotspotIcon) => onChange({ ...look, hotspotIcon })} placeholder="上传热点标记" previewSize="sm" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="hotspot-size">大小</Label>
              <Input id="hotspot-size" type="number" min={16} value={look.locationIconSize} onChange={(event) => onChange({ ...look, locationIconSize: Number(event.target.value) || look.locationIconSize })} />
              <p className="text-xs text-muted-foreground">像素，最小 16</p>
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

        <Button className="w-fit" disabled={saving} onClick={onSave}>{saving ? '保存中…' : '保存外观'}</Button>
      </CardContent>
    </Card>
  )
}
