/**
 * Ink Markdown DSL — 解析器、编译器、简易运行器
 *
 * 设计思路：
 * 1. 作者用简化的 Markdown 语法编写对话脚本
 * 2. 解析为中间表示 (SimpleStory)
 * 3. 编译为 Ink JSON（供运行时 InkEngine 使用）
 * 4. 简易运行器直接解释 SimpleStory（供预览使用）
 *
 * DSL 语法：
 * ```
 * ---
 * key: story_key
 * title: 故事标题
 * locationId: loc_xxx       (可选)
 * characterId: char_xxx     (可选)
 * ---
 *
 * # scene_id
 * bg: background_url
 *
 * Speaker: 对话内容第一行。
 * 同一说话人的第二行。
 *
 * *choice*
 * - 选项文本 1
 * - 选项文本 2
 * - 选项文本 3 -> target_scene
 *
 * # target_scene
 *
 * Speaker: 你选择了第三个选项！
 *
 * #end
 * ```
 */

// ─── 类型定义 ────────────────────────────────────────────────

export interface SimpleStoryMeta {
  key: string;
  title: string;
  locationId?: string;
  characterId?: string;
}

export interface SimpleDialogue {
  type: 'dialogue';
  speaker: string;
  text: string;
  expression?: string;
}

export interface SimpleNarration {
  type: 'narration';
  text: string;
}

export interface SimpleChoice {
  type: 'choice';
  options: SimpleChoiceOption[];
}

export interface SimpleChoiceOption {
  text: string;
  goto?: string; // 跳转到目标 scene，空则继续当前
}

export interface SimpleGoto {
  type: 'goto';
  target: string;
}

export interface SimpleEnd {
  type: 'end';
}

export interface SimpleBgChange {
  type: 'bg';
  url: string;
}

export interface SimpleWait {
  type: 'wait';
}

export type SimpleLine =
  | SimpleDialogue
  | SimpleNarration
  | SimpleChoice
  | SimpleGoto
  | SimpleEnd
  | SimpleBgChange
  | SimpleWait;

export interface SimpleScene {
  id: string;
  bg?: string;
  lines: SimpleLine[];
}

export interface SimpleStory {
  meta: SimpleStoryMeta;
  scenes: SimpleScene[];
}

// ─── 解析器：Markdown DSL → SimpleStory ──────────────────────

export function parseInkDsl(source: string): SimpleStory {
  const lines = source.split('\n');
  let i = 0;

  // Parse YAML front matter
  const meta: SimpleStoryMeta = { key: '', title: '' };
  if (lines[i]?.trim() === '---') {
    i++;
    while (i < lines.length && lines[i]?.trim() !== '---') {
      const line = lines[i].trim();
      const colonIdx = line.indexOf(':');
      if (colonIdx > 0) {
        const key = line.slice(0, colonIdx).trim();
        const value = line.slice(colonIdx + 1).trim();
        if (key === 'key') meta.key = value;
        else if (key === 'title') meta.title = value;
        else if (key === 'locationId') meta.locationId = value || undefined;
        else if (key === 'characterId') meta.characterId = value || undefined;
      }
      i++;
    }
    i++; // skip closing ---
  }

  const scenes: SimpleScene[] = [];
  let currentScene: SimpleScene | null = null;
  let pendingSpeaker: string | null = null;
  let pendingTextLines: string[] = [];

  function flushDialogue() {
    if (pendingSpeaker && pendingTextLines.length > 0) {
      currentScene!.lines.push({
        type: 'dialogue',
        speaker: pendingSpeaker,
        text: pendingTextLines.join('\n'),
      });
      pendingSpeaker = null;
      pendingTextLines = [];
    }
  }

  function startScene(id: string) {
    flushDialogue();
    currentScene = { id, lines: [] };
    scenes.push(currentScene);
  }

  // If no front matter, reset
  if (scenes.length === 0 && i < lines.length) {
    startScene('start');
  }

  while (i < lines.length) {
    const raw = lines[i];
    const trimmed = raw.trim();
    i++;

    // Empty line
    if (!trimmed) {
      flushDialogue();
      continue;
    }

    // Scene header: # scene_id
    const sceneMatch = trimmed.match(/^#\s+(\S+)/);
    if (sceneMatch) {
      startScene(sceneMatch[1]);
      continue;
    }

    // End marker: #end
    if (trimmed === '#end') {
      flushDialogue();
      if (currentScene) {
        currentScene.lines.push({ type: 'end' });
      }
      continue;
    }

    if (!currentScene) {
      startScene('start');
    }

    // BG change: bg: url
    const bgMatch = trimmed.match(/^bg:\s*(.+)/i);
    if (bgMatch) {
      flushDialogue();
      currentScene.lines.push({ type: 'bg', url: bgMatch[1].trim() });
      continue;
    }

    // Choice marker: *choice*
    if (trimmed === '*choice*' || trimmed === '*choices*') {
      flushDialogue();
      const options: SimpleChoiceOption[] = [];
      while (i < lines.length) {
        const optLine = lines[i].trim();
        const optMatch = optLine.match(/^-\s+(.+)/);
        if (!optMatch) break;
        i++;
        // Check for -> goto
        const gotoMatch = optMatch[1].match(/^(.+?)\s*->\s*(\S+)\s*$/);
        if (gotoMatch) {
          options.push({ text: gotoMatch[1].trim(), goto: gotoMatch[2] });
        } else {
          options.push({ text: optMatch[1].trim() });
        }
      }
      if (options.length > 0) {
        currentScene.lines.push({ type: 'choice', options });
      }
      continue;
    }

    // Wait marker
    if (trimmed === '*wait*') {
      flushDialogue();
      currentScene.lines.push({ type: 'wait' });
      continue;
    }

    // Goto: -> target_scene
    const gotoMatch = trimmed.match(/^->\s+(\S+)/);
    if (gotoMatch) {
      flushDialogue();
      currentScene.lines.push({ type: 'goto', target: gotoMatch[1] });
      continue;
    }

    // Narration (starts with * and space, like * 这是一段旁白)
    const narrMatch = trimmed.match(/^\*\s+(.+)/);
    if (narrMatch) {
      flushDialogue();
      currentScene.lines.push({ type: 'narration', text: narrMatch[1] });
      continue;
    }

    // Simple narration: just text without a speaker prefix
    // But this is tricky — it could also be a continuation. Let's treat lines
    // without "Speaker:" prefix as narration when there's no pending speaker.
    const speakerMatch = trimmed.match(/^([A-Za-z\u4e00-\u9fff][A-Za-z0-9\u4e00-\u9fff\s]{0,20}):\s*(.*)/);
    if (speakerMatch) {
      flushDialogue();
      pendingSpeaker = speakerMatch[1].trim();
      const text = speakerMatch[2].trim();
      if (text) pendingTextLines.push(text);
    } else if (pendingSpeaker) {
      // Continuation of previous speaker's dialogue
      pendingTextLines.push(trimmed);
    } else {
      // Narration without speaker
      flushDialogue();
      currentScene.lines.push({ type: 'narration', text: trimmed });
    }
  }

  flushDialogue();

  return { meta, scenes };
}

// ─── 编译器：SimpleStory → Ink JSON ──────────────────────────

export function compileToInkJson(story: SimpleStory): Record<string, any> {
  // We need to build a minimal but valid Ink compiled JSON.
  // The approach: create a flat structure with knot/stitch names using diverts.

  // For simplicity, we build a "thread" array that represents the story flow.
  // We use Ink's container format: ["^text", "\n", ...]

  const root: any[] = [];
  const sceneContainers: Record<string, any[]> = {};

  function pushText(container: any[], text: string) {
    // Escape Ink special characters
    const escaped = text.replace(/[{}\\]/g, '\\$&');
    container.push('^' + escaped, '\n');
  }

  function pushTag(container: any[], tag: string) {
    container.push('#' + tag);
  }

  function compileScene(scene: SimpleScene): any[] {
    const c: any[] = [];

    for (const line of scene.lines) {
      switch (line.type) {
        case 'dialogue': {
          pushTag(c, 'speaker:' + line.speaker);
          pushText(c, line.speaker + ': ' + line.text);
          break;
        }
        case 'narration': {
          pushText(c, line.text);
          break;
        }
        case 'bg': {
          pushTag(c, 'bg:' + line.url);
          break;
        }
        case 'wait': {
          pushTag(c, 'wait');
          pushTag(c, 'user_input');
          break;
        }
        case 'end': {
          c.push('end', null);
          break;
        }
        case 'goto': {
          // Use divert to target knot
          c.push('div', null, ['^->', line.target]);
          break;
        }
        case 'choice': {
          // Ink choice structure: a list where each element is
          // [text_container, null, target_container_or_divert]
          // The choices themselves are wrapped in a choice point
          const choiceItems: any[] = [];
          for (const opt of line.options) {
            const optContainer: any[] = [];
            pushText(optContainer, opt.text);

            if (opt.goto) {
              // Each option goes to its target
              const targetContainer: any[] = [];
              targetContainer.push('div', null, ['^->', opt.goto]);
              choiceItems.push(optContainer, null, targetContainer);
            } else {
              // Continue inline: option text is selected, story continues
              choiceItems.push(optContainer, null, null);
            }
          }
          // Wrap in a choice: [...options, null] where last null ends the choice
          choiceItems.push(null);
          // Use ev/str pattern for simple choices
          c.push(...choiceItems);
          break;
        }
      }
    }

    return c;
  }

  // Compile all scenes
  for (const scene of story.scenes) {
    sceneContainers[scene.id] = compileScene(scene);
  }

  // Build root: start with first scene, then define named scenes as knots
  if (story.scenes.length > 0) {
    const firstScene = story.scenes[0];
    root.push(...sceneContainers[firstScene.id]);
  }

  // For simplicity, we embed all scenes linearly if they're simple enough
  // In a more advanced version, we'd use proper Ink knots

  return {
    inkVersion: 21,
    root,
    listDefs: {},
  };
}

// ─── 简易运行器：用于预览 ───────────────────────────────────

export interface PreviewState {
  currentSceneId: string;
  currentLineIndex: number;
  dialogueHistory: { speaker: string; text: string }[];
  currentChoices: SimpleChoiceOption[];
  isEnded: boolean;
  isWaiting: boolean;
  currentBg?: string;
}

export function createPreviewRunner(story: SimpleStory) {
  const sceneMap = new Map<string, SimpleScene>();
  for (const s of story.scenes) {
    sceneMap.set(s.id, s);
  }

  let state: PreviewState = {
    currentSceneId: story.scenes[0]?.id ?? 'start',
    currentLineIndex: 0,
    dialogueHistory: [],
    currentChoices: [],
    isEnded: false,
    isWaiting: false,
  };

  function getCurrentScene(): SimpleScene | undefined {
    return sceneMap.get(state.currentSceneId);
  }

  function advance(): PreviewState {
    if (state.isEnded) return { ...state };

    const scene = getCurrentScene();
    if (!scene) {
      state.isEnded = true;
      return { ...state };
    }

    // Flush any pending choices first
    if (state.currentChoices.length > 0) {
      return { ...state };
    }

    const history = [...state.dialogueHistory];
    let newChoices: SimpleChoiceOption[] = [];
    let newBg = state.currentBg;
    let newIsWaiting = false;
    let newIsEnded = false;
    let newSceneId = state.currentSceneId;
    let newLineIndex = state.currentLineIndex;

    // Process lines until we hit something that needs user interaction
    while (newLineIndex < scene.lines.length) {
      const line = scene.lines[newLineIndex];
      newLineIndex++;

      switch (line.type) {
        case 'dialogue':
          history.push({ speaker: line.speaker, text: line.text });
          break;

        case 'narration':
          history.push({ speaker: '', text: line.text });
          break;

        case 'bg':
          newBg = line.url;
          break;

        case 'wait':
          newIsWaiting = true;
          // Return so caller can handle input
          return {
            ...state,
            currentLineIndex: newLineIndex,
            dialogueHistory: history,
            currentChoices: [],
            currentBg: newBg,
            isWaiting: true,
            isEnded: false,
          };

        case 'choice':
          newChoices = line.options;
          // Return so user can pick
          return {
            ...state,
            currentLineIndex: newLineIndex,
            dialogueHistory: history,
            currentChoices: newChoices,
            currentBg: newBg,
            isWaiting: false,
            isEnded: false,
          };

        case 'goto': {
          const targetScene = sceneMap.get(line.target);
          if (targetScene) {
            newSceneId = line.target;
            newLineIndex = 0;
            // Restart loop with new scene
            sceneMap.set('__current__', targetScene);
            // We need to break and restart
            const gotoState: PreviewState = {
              currentSceneId: newSceneId,
              currentLineIndex: 0,
              dialogueHistory: history,
              currentChoices: [],
              currentBg: newBg,
              isEnded: false,
              isWaiting: false,
            };
            // Recursively advance from new scene
            state = gotoState;
            return advance();
          }
          break;
        }

        case 'end':
          newIsEnded = true;
          return {
            ...state,
            currentLineIndex: newLineIndex,
            dialogueHistory: history,
            currentChoices: [],
            currentBg: newBg,
            isEnded: true,
            isWaiting: false,
          };
      }
    }

    // If we reach here, all lines processed, end of scene
    newIsEnded = true;

    state = {
      currentSceneId: newSceneId,
      currentLineIndex: newLineIndex,
      dialogueHistory: history,
      currentChoices: newChoices,
      currentBg,
      isEnded: newIsEnded,
      isWaiting: newIsWaiting,
    };

    return { ...state };
  }

  function selectChoice(choiceIndex: number): PreviewState {
    if (choiceIndex < 0 || choiceIndex >= state.currentChoices.length) {
      return { ...state };
    }

    const chosen = state.currentChoices[choiceIndex];
    state.currentChoices = [];

    // Record the choice as dialogue
    state.dialogueHistory = [
      ...state.dialogueHistory,
      { speaker: 'You', text: chosen.text },
    ];

    if (chosen.goto) {
      const targetScene = sceneMap.get(chosen.goto);
      if (targetScene) {
        state.currentSceneId = chosen.goto;
        state.currentLineIndex = 0;
        return advance();
      }
    }

    // Continue current scene
    return advance();
  }

  function reset() {
    state = {
      currentSceneId: story.scenes[0]?.id ?? 'start',
      currentLineIndex: 0,
      dialogueHistory: [],
      currentChoices: [],
      isEnded: false,
      isWaiting: false,
    };
  }

  function getFullHistory() {
    return state.dialogueHistory;
  }

  return {
    advance,
    selectChoice,
    reset,
    getState: () => ({ ...state }),
    getFullHistory,
  };
}
