/**
 * Quick debug: 打印 InkEngine 实际输出
 * npx tsx apps/frontend/src/features/vn-engine/__tests__/ink-debug.ts
 */
import { InkEngine } from '../ink-engine'

async function main() {
  const { Compiler } = await import('inkjs/full')
  
  const source = `
NPC: Hello!
NPC: How are you?
#input
NPC: I'm glad.
  `.trim()
  
  console.log('=== Source ===')
  console.log(source)
  
  const compiler = new Compiler(source, null)
  const story = compiler.Compile()
  console.log('\n=== Compile errors ===', compiler.errors)
  console.log('=== Compile warnings ===', compiler.warnings)
  
  const json = JSON.parse(String(story.ToJson() ?? ''))
  console.log('\n=== Compiled JSON (first 500 chars) ===')
  console.log(JSON.stringify(json).slice(0, 500))
  
  const engine = new InkEngine()
  engine.load(json)
  
  console.log('\n=== Continue #1 ===')
  const r1 = engine.continue()
  console.log('text:', JSON.stringify(r1?.text))
  console.log('hasChoices:', r1?.hasChoices)
  console.log('choices:', r1?.choices)
  console.log('tags:', engine.getCurrentTags())
  console.log('canContinue:', engine.canContinue)
  
  if (engine.canContinue) {
    console.log('\n=== Continue #2 ===')
    const r2 = engine.continue()
    console.log('text:', JSON.stringify(r2?.text))
    console.log('hasChoices:', r2?.hasChoices)
    console.log('tags:', engine.getCurrentTags())
  }
}

main().catch(console.error)
