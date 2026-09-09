import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

function normalizeExpr(s) {
  return String(s || '')
    .replace(/[.?!…]+$/u, '')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function parseCsvTexts(path) {
  const raw = readFileSync(path, 'utf8')
  const lines = raw.trim().split(/\r?\n/)
  const header = lines[0].split(',')
  const textIdx = header.indexOf('text')
  const texts = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    const cols = []
    let cur = ''
    let inQ = false
    for (let j = 0; j < line.length; j++) {
      const c = line[j]
      if (inQ) {
        if (c === '"' && line[j + 1] === '"') {
          cur += '"'
          j++
        } else if (c === '"') inQ = false
        else cur += c
      } else {
        if (c === '"') inQ = true
        else if (c === ',') {
          cols.push(cur)
          cur = ''
        } else cur += c
      }
    }
    cols.push(cur)
    texts.push(cols[textIdx])
  }
  return texts
}

const orig = parseCsvTexts(join(__dirname, '..', '常用英语500句', 'chunks.csv'))
const intro = parseCsvTexts(join(__dirname, '..', '常用英语500句：入门篇', 'chunks.csv'))
const origMap = new Map()
for (const t of orig) origMap.set(normalizeExpr(t), t)
const introSet = new Set(intro.map(normalizeExpr))

const keepers = [
  'Are you kidding?',
  'That depends.',
  'Then what?',
  'How is that possible?',
  "Why didn't you tell me?",
  'What shall we do tonight?',
  "Let's play it by ear.",
  'Not today.',
  'Not now.',
  'She comes along?',
  'Why bother?',
  'Afraid so.',
  'Wake me up at five thirty.',
  'Take your time to unpack.',
  'And get settled in.',
  'You should go pack.',
  'Do I start now?',
  "It's only for 2 weeks.",
  'show it to me.',
  'Allow me.',
  'Remember what the doctor said.',
  'Which book we talking about?',
  'All of a sudden.',
  "Something's up.",
  'I can explain.',
  'I thought I told you.',
  'We had a deal.',
  "Time's up.",
  'In the meantime.',
  'From now on.',
  'As always.',
  'Not again.',
  'That was close.',
  "I don't remember.",
  "Doesn't say.",
  'I have no choice.',
  "It's complicated.",
  'What am I supposed to do?',
  "You're breaking up.",
  'Start over.',
  'Take a break.',
  'Calm down.',
  'Be patient.',
  "Let's not waste our time.",
  'Stop making such a noise.',
  'I screwed up.',
  "I've had it.",
  'Get yourself together.',
  'I got it.',
  "I'll make it up to you.",
  'I am not mad.',
  "You're making me nervous.",
  "I'm exhausted.",
  "She's under the weather.",
  'He seems a little nervous.',
  "I'm fed up with my work!",
  'There there.',
  'Poor thing.',
  "That's the spirit.",
  "I'll do my best.",
  'Went well.',
  'We are all busy with work.',
  'You have my word.',
  'I promise.',
  'My turn.',
  "Who's turn?",
  'At this point.',
  'You promised me.',
  "That's for sure.",
  "It's a big deal.",
  "Don't let me down.",
  'I mean it.',
  "You've got a point there.",
  "That's a terrific idea!",
  'For your own good.',
  'Some exercise will do you good.',
  'I would guess that.',
  'To be honest.',
  'You were right.',
  'I think so.',
  "Don't get me wrong.",
  "It's no use complaining",
  'That makes no difference.',
  "What's the point?",
  'Go for it.',
  'Trust me.',
  'Hear me out.',
]

const fills = {
  T1: [
    'Who told you?',
    'How should I know.',
    'What can I say?',
    'Just say it.',
    'Not like that.',
    "That's impossible.",
    'I knew it.',
    'I doubt it.',
    "It doesn't make sense.",
    'Stop beating around the bush.',
    "I'll let you know when I recall.",
    'A penny for your thoughts?',
    'Who else.',
    "You didn't see it, did you?",
    'Not yet.',
  ],
  T2: [
    "I won't.",
    "Don't even think about it.",
    "We'll see about that.",
    'Now or never.',
    'If I were you.',
    'She got cold feet.',
    "He's still sitting on the fence.",
    'The ball is in your court.',
    'Me neither.',
    'So do I.',
    "I'm not.",
    'Nice try.',
    "Don't be silly.",
  ],
  T3: [
    'Go on in.',
    'show me.',
    "And don't tell.",
    'Business trip.',
    'On my own.',
    'I left it right here.',
    'Just a heads-up.',
    "You're off the hook.",
    'I will be more careful.',
    "Don't be rude.",
  ],
  T4: [
    "That's always the case.",
    "You've dodged a bullet.",
    'Mark my words.',
    "Don't let chances pass by.",
    'I will never forget it.',
  ],
  T5: [
    'Just do it.',
    'Cut it out.',
    'Give me a break.',
    'You have to bite the bullet.',
    "Don't cry over spilled milk.",
    "Let's bury the hatchet.",
    'Unbelievable.',
    "That's ridiculous.",
  ],
  T6: [
    "I'm tired.",
    "Don't cry.",
    'I miss you.',
    'This is incredible.',
    "It's amazing.",
    "I can't sleep.",
    "Don't leave me.",
    "I'm not leaving you.",
    'Let bygones be bygones.',
    'Do you have any idea how tired I am?',
  ],
  T7: [
    'Absolutely.',
    "That's true.",
    'No wonder.',
    'I can tell.',
    'I can see that.',
    'I have a lot on my plate.',
    "That's more like it.",
  ],
  T8: [
    'With all due respect.',
    "It's not rocket science.",
    "Don't bite off more than you can chew.",
    "It's the best of both worlds.",
    "Now you're talking",
    'All that matters.',
    "It's a win-win situation.",
    'The other way around.',
    'Great minds think alike.',
    'give him the benefit of the doubt.',
  ],
}

function check(label, list) {
  console.log('\n===' + label + '===')
  for (const t of list) {
    const n = normalizeExpr(t)
    const exact = origMap.get(n)
    const inIntro = introSet.has(n)
    if (!exact) console.log('MISS:', JSON.stringify(t))
    else if (exact !== t) console.log('CASE:', JSON.stringify(t), '->', JSON.stringify(exact))
    else if (inIntro) console.log('INTRO:', JSON.stringify(t))
    else console.log('OK')
  }
}

check('keepers', keepers)
for (const [k, v] of Object.entries(fills)) check(k, v)

const allFill = Object.values(fills).flat()
console.log('\nkeepers', keepers.length)
console.log('fills', allFill.length)
console.log('total proposed', keepers.length + allFill.length)

// Count how many keepers per suggested topic assignment from user
const tKeepers = {
  T1: ['Are you kidding?', 'That depends.', 'Then what?', 'How is that possible?', "Why didn't you tell me?"],
  T2: ['What shall we do tonight?', "Let's play it by ear.", 'Not today.', 'Not now.', 'She comes along?', 'Why bother?', 'Afraid so.'],
  T3: [
    'Wake me up at five thirty.',
    'Take your time to unpack.',
    'And get settled in.',
    'You should go pack.',
    'Do I start now?',
    "It's only for 2 weeks.",
    'show it to me.',
    'Allow me.',
    'Remember what the doctor said.',
    'Which book we talking about?',
  ],
  T4: [
    'All of a sudden.',
    "Something's up.",
    'I can explain.',
    'I thought I told you.',
    'We had a deal.',
    "Time's up.",
    'In the meantime.',
    'From now on.',
    'As always.',
    'Not again.',
    'That was close.',
    "I don't remember.",
    "Doesn't say.",
    'I have no choice.',
    "It's complicated.",
  ],
  T5: [
    'What am I supposed to do?',
    "You're breaking up.",
    'Start over.',
    'Take a break.',
    'Calm down.',
    'Be patient.',
    "Let's not waste our time.",
    'Stop making such a noise.',
    'I screwed up.',
    "I've had it.",
    'Get yourself together.',
    'I got it.',
  ],
  T6: [
    "I'll make it up to you.",
    'I am not mad.',
    "You're making me nervous.",
    "I'm exhausted.",
    "She's under the weather.",
    'He seems a little nervous.',
    "I'm fed up with my work!",
    'There there.',
    'Poor thing.',
    "That's the spirit.",
  ],
  T7: [
    "I'll do my best.",
    'Went well.',
    'We are all busy with work.',
    'You have my word.',
    'I promise.',
    'My turn.',
    "Who's turn?",
    'At this point.',
    'You promised me.',
    "That's for sure.",
    "It's a big deal.",
    "Don't let me down.",
    'I mean it.',
  ],
  T8: [
    "You've got a point there.",
    "That's a terrific idea!",
    'For your own good.',
    'Some exercise will do you good.',
    'I would guess that.',
    'To be honest.',
    'You were right.',
    'I think so.',
    "Don't get me wrong.",
    "It's no use complaining",
    'That makes no difference.',
    "What's the point?",
    'Go for it.',
    'Trust me.',
    'Hear me out.',
  ],
}

for (const [k, keep] of Object.entries(tKeepers)) {
  const fill = fills[k]
  console.log(k, 'keepers', keep.length, 'fills', fill.length, 'total', keep.length + fill.length)
}
