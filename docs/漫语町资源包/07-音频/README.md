# 07-音频

三类，别混。混了以后 `bgmUrl` / `ambientUrl` / `# audio:` 会互相覆盖。

| 目录 | 用途 | 落到哪 |
|---|---|---|
| `BGM/` | 有旋律的背景音乐 | `GameLocation.bgmUrl`、`GameRoom.bgmUrl` |
| `环境音/` | 无旋律的氛围层，与 BGM 叠加播放 | `GameLocation.ambientUrl`、`GameRoom.ambientUrl` |
| `SFX/` | 一次性音效 | Ink 的 `# audio:` 或前端事件 |

## 规格

- MP3 128–192 kbps。
- BGM 与环境音**必须无缝循环**：首尾各留 0.3s 的相同片段，导出前在 Audacity 里试听接缝。
- 响度统一归一化到 **-16 LUFS**，否则集与集之间会忽大忽小。
- SFX 单声道即可，长度 < 2s。

## 清单

### BGM（13 首）
`bgm_town_day` `bgm_town_dusk` `bgm_town_night` `bgm_cafe` `bgm_bakery` `bgm_library` `bgm_workshop` `bgm_gym` `bgm_market` `bgm_bath` `bgm_festival` `bgm_letter` `bgm_tension`

**P0 只需三首**：`bgm_town_day`（日常）、`bgm_cafe`（室内）、`bgm_festival`（庆典）。

### 环境音（14 条）
`amb_wind` `amb_street` `amb_plaza` `amb_river` `amb_post` `amb_library` `amb_cafe` `amb_bakery` `amb_market` `amb_workshop` `amb_gym` `amb_bath` `amb_rain` `amb_birds`

### SFX（8 条）
`sfx_postmark` `sfx_lantern_light` `sfx_doorbell` `sfx_bell` `sfx_page` `sfx_cup` `sfx_camera` `sfx_stamp`

## 与配音的关系

角色对白的 TTS 音频**不放这里**。对白音频由后台按角色音色批量生成，写进 `# audio:` 标签，不进这套资源包。这里只管「世界的声音」。
