/**
 * 批量生成所有学习包的 Ink 练习脚本
 * 运行: npx tsx apps/backend/prisma/scripts/generate-practice-inks.ts
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'

const PKG_DIR = resolve(__dirname, '..', 'data', 'packages')

interface TopicRow {
  scene_title: string
  title: string
  prompt_en: string
  prompt_zh: string
  duration_sec: string
  difficulty: string
  description: string
  knowledge_points: string
  ink_script_key: string
}

// ── 为每个场景生成适配的 NPC 名和 chunks ──
function getSceneConfig(sceneTitle: string): {
  npcName: string
  npcRole: string
  defaultChunks: string[]
} {
  const configs: Record<string, { npcName: string; npcRole: string; defaultChunks: string[] }> = {
    '图书馆借书': { npcName: 'Librarian', npcRole: '图书管理员', defaultChunks: ["I'd like to borrow...", 'Do you have...?', 'How long can I keep it?'] },
    '社团招新': { npcName: 'Club President', npcRole: '社团负责人', defaultChunks: ["I'm interested in joining", 'What activities do you have?', 'When do you meet?'] },
    '课堂发言': { npcName: 'Professor', npcRole: '教授', defaultChunks: ['In my opinion...', 'I think that...', 'Could you explain...?'] },
    '食堂点餐': { npcName: 'Cafeteria Staff', npcRole: '食堂工作人员', defaultChunks: ["I'd like to order...", 'How much is...?', 'Can I get...?'] },
    '宿舍入住': { npcName: 'Sarah', npcRole: '宿舍前台', defaultChunks: ["I'm here to check in", 'I have a reservation', 'My name is...'] },
    '认识室友': { npcName: 'Alex', npcRole: '室友', defaultChunks: ['Nice to meet you', "I'm from...", "I'm majoring in..."] },
    '咖啡店点餐': { npcName: 'Barista', npcRole: '咖啡师', defaultChunks: ["I'd like a...", 'Can I have...?', 'How much is that?'] },
    '超市购物': { npcName: 'Store Clerk', npcRole: '店员', defaultChunks: ['Where can I find...?', 'How much is this?', 'Do you have...?'] },
    '打车出行': { npcName: 'Taxi Driver', npcRole: '司机', defaultChunks: ['Can you take me to...?', 'How long will it take?', 'How much is the fare?'] },
    '小组讨论': { npcName: 'Group Member', npcRole: '小组成员', defaultChunks: ['I agree with...', 'What do you think about...?', 'Maybe we should...'] },
    '面试自我介绍': { npcName: 'Interviewer', npcRole: '面试官', defaultChunks: ["My name is...", "I'm studying...", 'I have experience in...'] },
    '机场入境': { npcName: 'Immigration Officer', npcRole: '入境官员', defaultChunks: ["I'm here to study", "I'll be staying for...", 'Here is my passport'] },
    '买 SIM 卡': { npcName: 'Phone Store Clerk', npcRole: '手机店员', defaultChunks: ["I need a SIM card", 'What plans do you have?', 'How much data?'] },
  }

  // Fuzzy match
  for (const [key, cfg] of Object.entries(configs)) {
    if (sceneTitle.includes(key) || key.includes(sceneTitle)) return cfg
  }

  return {
    npcName: 'Staff',
    npcRole: '工作人员',
    defaultChunks: ['Can you help me with...?', "I'd like to...", 'Could you tell me...?'],
  }
}

function generateInkSource(topic: TopicRow): string {
  const config = getSceneConfig(topic.scene_title)
  const npc = config.npcName
  const chunks = config.defaultChunks.join('|')
  const objective = topic.prompt_en || `Respond to the ${npc}'s question`

  return `---\nkey: ${topic.ink_script_key}\ntitle: ${topic.scene_title} - ${topic.title}\n---\n${npc}: ${topic.prompt_en.replace(/\n/g, ' ')}\n#objective: ${objective}\n#chunks: ${chunks}\n#user_input\n${npc}: Thanks for sharing! Is there anything else you'd like to add or ask?\n#objective: Follow up or ask a related question\n#chunks: ${chunks}\n#user_input\n${npc}: Got it. That was really helpful. Have a great day!\n-> END\n`
}

async function main() {
  const { readdirSync } = await import('fs')
  const dirs = readdirSync(PKG_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)

  let total = 0

  for (const dir of dirs) {
    const csvPath = resolve(PKG_DIR, dir, 'training_topics.csv')
    const inkDir = resolve(PKG_DIR, dir, 'ink-scripts')
    
    if (!existsSync(csvPath)) continue
    
    const csv = readFileSync(csvPath, 'utf-8')
    const lines = csv.trim().split('\n')
    if (lines.length <= 1) continue // header only

    const headers = lines[0].split(',')
    const dataRows = lines.slice(1)

    mkdirSync(inkDir, { recursive: true })

    for (const row of dataRows) {
      const cols = row.split(',')
      const obj: any = {}
      headers.forEach((h, i) => { obj[h.trim()] = (cols[i] || '').trim() })

      const topic: TopicRow = {
        scene_title: obj.scene_title,
        title: obj.title,
        prompt_en: obj.prompt_en,
        prompt_zh: obj.prompt_zh,
        duration_sec: obj.duration_sec,
        difficulty: obj.difficulty,
        description: obj.description || '',
        knowledge_points: obj.knowledge_points || '',
        ink_script_key: obj.ink_script_key || '',
      }

      if (!topic.ink_script_key) {
        topic.ink_script_key = `practice_${dir}_${topic.scene_title.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}_${topic.title.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`
      }

      const inkSource = generateInkSource(topic)
      const json = {
        key: topic.ink_script_key,
        title: `${topic.scene_title} - ${topic.title}`,
        scriptType: 'practice',
        inkSource,
      }

      const filePath = resolve(inkDir, `${topic.ink_script_key}.json`)
      writeFileSync(filePath, JSON.stringify(json, null, 2) + '\n')
      console.log(`  ✓ ${dir}/${topic.ink_script_key}.json — ${topic.scene_title} / ${topic.title}`)
      total++
    }
  }

  console.log(`\n🎉 生成 ${total} 个 Ink 脚本`)
}

main().catch(console.error)
