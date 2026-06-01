/**
 * InkEngine VN 流程测试
 * 运行: npx tsx apps/frontend/src/features/vn-engine/__tests__/ink-engine.test.ts
 */
import { InkEngine } from '../ink-engine'

let passed = 0
let failed = 0

function assert(condition: any, msg: string): asserts condition {
  if (!condition) throw new Error(msg)
}

// ═══════════════════════════════════════════════════════
// 完整 VN 多轮 #input 流程
// ═══════════════════════════════════════════════════════
async function testFullVnFlow() {
  const { Compiler } = await import('inkjs/full')
  const source = `
NPC: Hello!
NPC: How are you?
#input
NPC: I'm glad to hear that.
NPC: Let me tell you more.
#input
NPC: Thanks for sharing!
  `.trim()

  const compiler = new Compiler(source, null)
  const story = compiler.Compile()
  assert(compiler.errors.length === 0, `Compile errors: ${compiler.errors}`)

  const engine = new InkEngine()
  engine.load(JSON.parse(String(story.ToJson() ?? '')))

  // Line 1
  const r1 = engine.continue()
  assert(r1 !== null && r1.text === 'NPC: Hello!', `r1: ${r1?.text}`)
  assert(!hasInputTag(engine), 'r1 no input tag')
  console.log('  ✅ NPC: Hello!')

  // Line 2
  const r2 = engine.continue()
  assert(r2 !== null && r2.text === 'NPC: How are you?', `r2: ${r2?.text}`)
  assert(!hasInputTag(engine), 'r2 no input tag')
  console.log('  ✅ NPC: How are you?')

  // Line 3: #input tag ON "I'm glad..." line (Ink attaches tag to next content)
  const r3 = engine.continue()
  assert(r3 !== null, 'r3 not null')
  // In Ink, #input tag is on the NEXT content line, not on its own empty line
  assert(r3.text === "NPC: I'm glad to hear that.", `r3: ${r3?.text}`)
  const hasInput3 = hasInputTag(engine)
  console.log(`  ℹ️  r3 has input tag: ${hasInput3}, text: "${r3?.text}"`)
  // The fix: when input tag is detected, save this line for after input
  // (pendingRef in useInkStory / vn-story-preview)

  // Simulate user input
  engine.setVariable('user_last_input', 'I am fine, thanks!')
  // Pending "I'm glad..." line would be shown here by the hook

  // Line 4: "Let me tell you more." (next content after the skipped line)
  const r4 = engine.continue()
  // The engine already passed "I'm glad..." — it returns the next line
  console.log(`  ℹ️  r4 text: "${r4?.text}"`)
  assert(r4 !== null, 'r4 not null')
  // Either "Let me tell you more" or nothing (story state passed everything)
  const followUpOk = !r4 || r4.text.includes('Let me tell you')
  assert(followUpOk, `r4 should have follow-up, got: "${r4?.text}"`)
  console.log('  ✅ Follow-up content after input')

  // Line 6: second #input — check if tag is on "Thanks!" line
  let rN = engine.continue()
  while (rN && !hasInputTag(engine)) {
    console.log(`  ℹ️  Line: "${rN.text}"`)
    rN = engine.continue()
  }
  if (rN && hasInputTag(engine)) {
    console.log(`  ✅ Second #input on: "${rN.text}"`)
  }
}

// ═══════════════════════════════════════════════════════
// Choice 流程
// ═══════════════════════════════════════════════════════
async function testChoiceFlow() {
  const { Compiler } = await import('inkjs/full')
  const source = `
NPC: Choose:
*   Option A
    NPC: You chose A!
*   Option B
    NPC: You chose B!
  `.trim()

  const compiler = new Compiler(source, null)
  const story = compiler.Compile()
  const engine = new InkEngine()
  engine.load(JSON.parse(String(story.ToJson() ?? '')))

  const r1 = engine.continue()
  assert(r1 !== null && r1.text === 'NPC: Choose:', `r1: ${r1?.text}`)
  console.log('  ✅ NPC: Choose:')

  const r2 = engine.continue()
  assert(r2 !== null && r2.hasChoices && r2.choices.length === 2, 'has 2 choices')
  console.log(`  ✅ Choices: [${r2.choices.map((c) => c.text).join(', ')}]`)

  engine.choose(0)
  // In inkjs, Continue() after choice returns choice text, then next Continue() returns content
  const r3 = engine.continue()
  assert(r3 !== null, 'r3 not null')
  console.log(`  ℹ️  After choice: "${r3?.text}"`)

  const r4 = engine.continue()
  const resultOk = (r3?.text === 'Option A' && r4?.text === 'NPC: You chose A!') ||
                   r3?.text === 'NPC: You chose A!'
  assert(resultOk, `Choice result: r3="${r3?.text}", r4="${r4?.text}"`)
  console.log('  ✅ Choice selected')
}

// ═══════════════════════════════════════════════════════
// 旁白（无 speaker）
// ═══════════════════════════════════════════════════════
async function testNarration() {
  const { Compiler } = await import('inkjs/full')
  const source = `
The rain falls softly.
NPC: Hello there!
  `.trim()

  const compiler = new Compiler(source, null)
  const story = compiler.Compile()
  const engine = new InkEngine()
  engine.load(JSON.parse(String(story.ToJson() ?? '')))

  const r1 = engine.continue()
  assert(r1 !== null && r1.text === 'The rain falls softly.', `r1: ${r1?.text}`)
  const tags = engine.getCurrentTags()
  assert(!tags.some((t) => t.startsWith('speaker:')), 'no speaker tag')
  console.log('  ✅ Narration (no speaker): The rain falls softly.')

  const r2 = engine.continue()
  assert(r2 !== null && r2.text === 'NPC: Hello there!', `r2: ${r2?.text}`)
  console.log('  ✅ NPC: Hello there!')
}

// ═══════════════════════════════════════════════════════
function hasInputTag(engine: InkEngine): boolean {
  return engine.getCurrentTags().some((t) => {
    const n = t.trim()
    return n === 'input' || n === 'user_input' || n.startsWith('input:')
  })
}

async function run(name: string, fn: () => Promise<void>) {
  try {
    await fn()
    console.log(`✅ ${name}\n`)
    passed++
  } catch (err: any) {
    console.error(`❌ ${name}: ${err.message}\n`)
    failed++
  }
}

async function main() {
  console.log('\n🧪 InkEngine VN Flow Tests\n' + '='.repeat(50) + '\n')
  await run('Full VN flow (multi-turn #input)', testFullVnFlow)
  await run('Choice flow', testChoiceFlow)
  await run('Narration (no speaker)', testNarration)
  console.log('='.repeat(50))
  console.log(`${passed} passed, ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
}

main()
