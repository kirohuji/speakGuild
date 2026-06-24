/**
 * 模板匹配 — 在背景图中找到图标的最佳匹配位置
 * 返回百分比坐标 { x, y, width, height }（0-100）
 */

interface MatchResult {
  x: number
  y: number
  width: number
  height: number
  confidence: number
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

function toGrayScale(
  imageData: ImageData,
  out: Float32Array,
) {
  const { data } = imageData
  const len = imageData.width * imageData.height
  for (let i = 0; i < len; i++) {
    const r = data[i * 4]
    const g = data[i * 4 + 1]
    const b = data[i * 4 + 2]
    out[i] = 0.299 * r + 0.587 * g + 0.114 * b
  }
}

/**
 * 在背景图中搜索模板的最佳匹配位置。
 * 使用归一化互相关 (NCC) 提高对亮度差异的鲁棒性。
 */
export async function matchTemplate(
  backgroundUrl: string,
  iconUrl: string,
): Promise<MatchResult | null> {
  try {
    const [bgImg, iconImg] = await Promise.all([
      loadImage(backgroundUrl),
      loadImage(iconUrl),
    ])

    // 缩放到合理尺寸以提升性能
    const maxDim = 400
    const bgScale = Math.min(1, maxDim / Math.max(bgImg.naturalWidth, bgImg.naturalHeight))
    const iconScale = Math.min(1, maxDim / Math.max(iconImg.naturalWidth, iconImg.naturalHeight))

    const bgW = Math.round(bgImg.naturalWidth * bgScale)
    const bgH = Math.round(bgImg.naturalHeight * bgScale)
    const iconW = Math.round(iconImg.naturalWidth * iconScale)
    const iconH = Math.round(iconImg.naturalHeight * iconScale)

    // 绘制缩略背景
    const bgCanvas = document.createElement('canvas')
    bgCanvas.width = bgW
    bgCanvas.height = bgH
    const bgCtx = bgCanvas.getContext('2d')!
    bgCtx.drawImage(bgImg, 0, 0, bgW, bgH)
    const bgData = bgCtx.getImageData(0, 0, bgW, bgH)
    const bgGray = new Float32Array(bgW * bgH)
    toGrayScale(bgData, bgGray)

    // 绘制缩略图标
    const iconCanvas = document.createElement('canvas')
    iconCanvas.width = iconW
    iconCanvas.height = iconH
    const iconCtx = iconCanvas.getContext('2d')!
    iconCtx.drawImage(iconImg, 0, 0, iconW, iconH)
    const iconData = iconCtx.getImageData(0, 0, iconW, iconH)
    const iconGray = new Float32Array(iconW * iconH)
    toGrayScale(iconData, iconGray)

    // 计算模板均值（用于 NCC）
    let iconMean = 0
    for (let i = 0; i < iconGray.length; i++) iconMean += iconGray[i]
    iconMean /= iconGray.length

    const iconNorm = new Float32Array(iconGray.length)
    let iconStd = 0
    for (let i = 0; i < iconGray.length; i++) {
      const d = iconGray[i] - iconMean
      iconNorm[i] = d
      iconStd += d * d
    }
    iconStd = Math.sqrt(iconStd) || 1

    // 滑动窗口搜索
    const step = Math.max(1, Math.round(Math.min(iconW, iconH) / 4))
    let bestX = 0
    let bestY = 0
    let bestScore = -Infinity

    for (let y = 0; y <= bgH - iconH; y += step) {
      for (let x = 0; x <= bgW - iconW; x += step) {
        // 计算窗口均值
        let winMean = 0
        for (let j = 0; j < iconH; j++) {
          const row = (y + j) * bgW
          for (let i = 0; i < iconW; i++) {
            winMean += bgGray[row + x + i]
          }
        }
        winMean /= iconGray.length

        // NCC numerator
        let num = 0
        let winStd = 0
        for (let j = 0; j < iconH; j++) {
          const row = (y + j) * bgW
          for (let i = 0; i < iconW; i++) {
            const d = bgGray[row + x + i] - winMean
            num += d * iconNorm[j * iconW + i]
            winStd += d * d
          }
        }
        winStd = Math.sqrt(winStd) || 1
        const score = num / (iconStd * winStd)

        if (score > bestScore) {
          bestScore = score
          bestX = x
          bestY = y
        }
      }
    }

    // 映射回原始坐标（百分比）
    const xPct = (bestX / bgScale / bgImg.naturalWidth) * 100
    const yPct = (bestY / bgScale / bgImg.naturalHeight) * 100
    const wPct = (iconImg.naturalWidth / bgImg.naturalWidth) * 100
    const hPct = (iconImg.naturalHeight / bgImg.naturalHeight) * 100

    return {
      x: Math.round(xPct * 100) / 100,
      y: Math.round(yPct * 100) / 100,
      width: Math.round(wPct * 100) / 100,
      height: Math.round(hPct * 100) / 100,
      confidence: Math.round(bestScore * 1000) / 1000,
    }
  } catch (err) {
    console.warn('[matchTemplate] 匹配失败:', err)
    return null
  }
}
