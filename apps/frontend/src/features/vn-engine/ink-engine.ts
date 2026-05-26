import { Story } from 'inkjs'

/**
 * Ink 叙事引擎封装
 * 负责加载 Ink JSON、驱动对话流、管理分支选择、存档序列化
 */
export class InkEngine {
  private story: Story | null = null
  private onExternalFunction?: (name: string, args: any[]) => any

  /** 加载 Ink 编译后的 JSON */
  load(json: Record<string, any>) {
    try {
      this.story = new Story(json as any)
      // Bind external functions
      this.bindExternal('waitForUserInput')
      this.bindExternal('triggerJudge')
      this.bindExternal('showExpression')
      this.bindExternal('setFlag')
    } catch (err) {
      console.warn('[InkEngine] Failed to load Ink story:', err)
      this.story = null
    }
  }

  /** 注册外部函数处理器 */
  onExternal(callback: (name: string, args: any[]) => any) {
    this.onExternalFunction = callback
  }

  /** 绑定 Ink 外部函数 */
  private bindExternal(name: string) {
    if (!this.story) return
    try {
      this.story.BindExternalFunction(name, (...args: any[]) => {
        if (this.onExternalFunction) {
          return this.onExternalFunction(name, args)
        }
        return undefined
      })
    } catch {
      // External function not declared in this script, ignore
    }
  }

  /** 继续叙事，返回下一段文本 */
  continue(): { text: string; hasChoices: boolean; choices: { index: number; text: string }[] } | null {
    if (!this.story) return null
    if (!this.story.canContinue) {
      // Check for choices
      const inkChoices = this.story.currentChoices
      if (inkChoices.length > 0) {
        return {
          text: '',
          hasChoices: true,
          choices: inkChoices.map((c) => ({ index: c.index, text: c.text })),
        }
      }
      return null // Story ended
    }

    const text = this.story.Continue()?.trim() ?? ''
    const inkChoices = this.story.currentChoices

    return {
      text,
      hasChoices: inkChoices.length > 0,
      choices: inkChoices.map((c) => ({ index: c.index, text: c.text })),
    }
  }

  /** 选择分支 */
  choose(choiceIndex: number) {
    if (!this.story) return null
    this.story.ChooseChoiceIndex(choiceIndex)
  }

  /** 设置变量值 */
  setVariable(name: string, value: any) {
    if (!this.story) return
    try {
      this.story.variablesState[name] = value
    } catch {
      // Variable not found
    }
  }

  /** 获取变量值 */
  getVariable(name: string): any {
    if (!this.story) return undefined
    try {
      return this.story.variablesState[name]
    } catch {
      return undefined
    }
  }

  /** 获取当前标签 */
  getCurrentTags(): string[] {
    if (!this.story) return []
    return this.story.currentTags ?? []
  }

  /** 是否还能继续 */
  get canContinue(): boolean {
    return this.story?.canContinue ?? false
  }

  /** 序列化当前状态 */
  saveState(): string {
    if (!this.story) return ''
    return this.story.state.ToJson()
  }

  /** 恢复状态 */
  loadState(json: string) {
    if (!this.story) return
    this.story.state.LoadJson(json)
  }

  /** 获取故事中访问过的标签 */
  get visitedTags(): string[] {
    if (!this.story) return []
    try {
      return (this.story as any).state._visitCounts
        ? Object.keys((this.story as any).state._visitCounts)
        : []
    } catch {
      return []
    }
  }

  destroy() {
    this.story = null
  }
}
