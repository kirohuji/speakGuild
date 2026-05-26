/**
 * Ink 编译器封装 — 基于 inkjs v2.4.0 内置 Compiler
 *
 * 正确 Ink 语法参考：
 * ```
 * === knot_name ===          ← 定义场景（knot）
 * # tag_name                 ← 标签（# speaker:Alex, # expression:happy, # bg:url）
 * Hello world!               ← 普通文本
 * *  选项文本                 ← 选项（* 开头）
 *     +  粘性选项             ← 粘性选项（不消失）
 * -> target_knot             ← 跳转到目标
 * -> END                     ← 结束
 * { variable }               ← 显示变量
 * ```
 */

import { Compiler } from 'inkjs/compiler/Compiler'
import type { Story } from 'inkjs/engine/Story'

export interface CompileResult {
  success: boolean
  /** 编译后的 Ink JSON（可直接传给 InkEngine.load()） */
  json: Record<string, any> | null
  /** 编译错误 */
  errors: string[]
  /** 编译警告 */
  warnings: string[]
  /** 作者消息（TODO 等） */
  authorMessages: string[]
}

/**
 * 编译 Ink 源码为 JSON
 */
export function compileInk(source: string): CompileResult {
  try {
    // Strip YAML front matter (--- block) before compilation —
    // this is our custom metadata convention, NOT valid Ink syntax
    const { remainingSource } = extractInkMeta(source)
    const inkSource = remainingSource.trim()

    if (!inkSource) {
      return {
        success: false,
        json: null,
        errors: ['Ink 脚本为空（去掉元数据后没有内容）'],
        warnings: [],
        authorMessages: [],
      }
    }

    const compiler = new Compiler(inkSource, null)
    const story: Story = compiler.Compile()

    const errors = compiler.errors ?? []
    const warnings = compiler.warnings ?? []
    const authorMessages = compiler.authorMessages ?? []

    if (errors.length > 0) {
      return {
        success: false,
        json: null,
        errors,
        warnings,
        authorMessages,
      }
    }

    // Serialize compiled story to JSON for storage
    const jsonStr = story.ToJson()
    const json = JSON.parse(jsonStr)

    return {
      success: true,
      json,
      errors,
      warnings,
      authorMessages,
    }
  } catch (err: any) {
    return {
      success: false,
      json: null,
      errors: [err?.message || 'Unknown compilation error'],
      warnings: [],
      authorMessages: [],
    }
  }
}

/**
 * 从 Ink 源码中提取 YAML 元数据（--- 块）
 */
export function extractInkMeta(source: string): {
  key: string
  title: string
  locationId?: string
  characterId?: string
  remainingSource: string
} {
  const lines = source.split('\n')
  let key = ''
  let title = ''
  let locationId: string | undefined
  let characterId: string | undefined
  let metaEnd = -1

  if (lines[0]?.trim() === '---') {
    for (let i = 1; i < lines.length; i++) {
      if (lines[i]?.trim() === '---') {
        metaEnd = i
        break
      }
      const colonIdx = lines[i].indexOf(':')
      if (colonIdx > 0) {
        const k = lines[i].slice(0, colonIdx).trim()
        const v = lines[i].slice(colonIdx + 1).trim()
        if (k === 'key') key = v
        else if (k === 'title') title = v
        else if (k === 'locationId') locationId = v || undefined
        else if (k === 'characterId') characterId = v || undefined
      }
    }
  }

  const remainingSource = metaEnd >= 0
    ? lines.slice(metaEnd + 1).join('\n')
    : source

  return { key, title, locationId, characterId, remainingSource }
}

/**
 * 生成默认 Ink 模板
 */
export function defaultInkTemplate(options?: {
  key?: string
  title?: string
}): string {
  const key = options?.key || 'my_story'
  const title = options?.title || '我的故事'

  return `---
key: ${key}
title: ${title}
---

=== start ===
# speaker: Alex
# expression: default
Alex: 嗨！欢迎来到这里。
今天过得怎么样？

*   挺好的，谢谢！ -> tour
*   有点累，但是还不错。 -> tour
*   我想四处看看。 -> look_around

=== tour ===
# speaker: Alex
# expression: happy
Alex: 太好了！让我带你参观一下吧。
这里是我们最受欢迎的地方之一。
# wait
-> END

=== look_around ===
# speaker: Alex
Alex: 好的，有什么问题随时问我！
-> END
`
}
