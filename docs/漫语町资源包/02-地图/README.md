# 02-地图

放**认知层面的地图**：一张全景图 + 一组地点图标。这里不放对话背景（对话背景在 `03-背景`）。

## 需要什么

| 文件 | 数量 | 优先级 | 用途 |
|---|---:|---|---|
| `map_manyu_day.webp` | 1 | P0 | 探索模式默认底图，对应 `GameMap.backgroundUrl` |
| `map_manyu_night.webp` | 1 | P1 | 夜间/庆典前，构图必须与 day 完全一致 |
| `map_manyu_festival.webp` | 1 | P1 | 庆典日，全图挂上灯串 |
| `icon_<地点键>.png` | 17 | P0 六个 / 其余 P1–P2 | 地点标记，对应 `GameLocation.icon` |

## 地图要求

- 1920 × 1080（要做平移就 2560 × 1440）。
- 俯视或等距视角，**17 个地点必须各有可辨识的建筑轮廓**。
- **不写文字标签**，地名由 UI 渲染——这样换语言不用重画。
- 布局按 `01-剧本/地点房间与背景对照表.md` 的坐标表；钟楼是视觉锚点，放在中轴线上。
- day / night / festival 三张必须同构图，切时段不能跳画面。

## 图标要求

- 256 × 256 PNG 透明，单色描边 + 简形剪影。
- 显示尺寸只有 26px 左右，**细节必须放弃**：咖啡店就是杯子，邮局就是信封，钟楼就是个尖顶。
- 选中态与未解锁态用同一张图，靠 UI 调透明度，不要出两套。

## 落库

```text
GameMap.name        = manyu
GameMap.displayName = 漫语町
GameMap.backgroundUrl = map_manyu_day
GameLocation.icon   = icon_cafe     ← 只写别名
GameLocation.posX   = 36（按宽度 1920 换算百分比）
```

进地图编辑器之前先把图标收齐，否则无法确认点位是否被遮挡。
