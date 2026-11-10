import { describe, expect, it } from 'vitest'
import { TABLE_NAMES, DB_VERSION } from '../sqlite/schema'
import type { SyncEntityType } from '../sync-outbox'

describe('script offline isolation schema', () => {
  it('registers script cache tables in DB v15', () => {
    expect(DB_VERSION).toBe(15)
    expect(TABLE_NAMES).toContain('script_practice_records')
    expect(TABLE_NAMES).toContain('script_works')
  })

  it('accepts script practice and nqtr save outbox entity types', () => {
    const entities: SyncEntityType[] = ['script_practice_record', 'nqtr_save']
    expect(entities).toEqual(['script_practice_record', 'nqtr_save'])
  })

  it('treats nqtr and story progress keys as user-scoped prefixes', () => {
    const userScopedPrefixes = [
      'guided-progress:',
      'guided-session:',
      'manyu:novel-progress:',
      'nqtr-save:',
      'story-episode-passed:',
    ]
    const keys = [
      'nqtr-save:scene-a:1',
      'story-episode-passed:ep-1',
      'guided-progress:topic-1',
      'theme-preference',
    ]
    const cleared = keys.filter((key) => userScopedPrefixes.some((prefix) => key.startsWith(prefix)))
    expect(cleared).toEqual([
      'nqtr-save:scene-a:1',
      'story-episode-passed:ep-1',
      'guided-progress:topic-1',
    ])
  })
})
