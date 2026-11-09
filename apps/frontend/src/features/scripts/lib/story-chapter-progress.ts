import type { StoryEpisodeItem } from '@/features/learning/api/learning-api'

const KEY_PREFIX = 'story-episode-passed:'

export function readLocalStoryEpisodePassed(episodeId: string): boolean {
  try {
    return localStorage.getItem(`${KEY_PREFIX}${episodeId}`) === '1'
  } catch {
    return false
  }
}

export function writeLocalStoryEpisodePassed(episodeId: string) {
  try {
    localStorage.setItem(`${KEY_PREFIX}${episodeId}`, '1')
  } catch {
    /* quota / private mode */
  }
}

export function withLocalStoryProgress(episodes: StoryEpisodeItem[]): StoryEpisodeItem[] {
  return episodes.map((episode) => {
    if (episode.record?.passed || !readLocalStoryEpisodePassed(episode.id)) return episode
    return {
      ...episode,
      record: episode.record
        ? { ...episode.record, passed: true }
        : {
            id: `local:${episode.id}`,
            passed: true,
            completedObjectiveCount: episode.objectives?.length ?? 0,
            usedChunkCount: 0,
            turnCount: 0,
            retellCompleted: false,
            xpEarned: 0,
            completedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          },
    }
  })
}

/** 前一章未通关则锁后章；显式 prerequisite 优先。 */
export function resolveStoryEpisodeUnlock(episodes: StoryEpisodeItem[]): StoryEpisodeItem[] {
  const withProgress = withLocalStoryProgress(episodes)
  return withProgress.map((episode, index) => {
    if (episode.record?.passed || episode.isPreview) {
      return { ...episode, isUnlocked: true }
    }
    const previousPassed = index === 0 || Boolean(withProgress[index - 1]?.record?.passed)
    const prerequisiteSatisfied = episode.prerequisiteEpisodeIds.length > 0
      ? episode.prerequisiteEpisodeIds.every((requiredId) =>
          withProgress.some((candidate) => candidate.id === requiredId && candidate.record?.passed),
        )
      : previousPassed
    return { ...episode, isUnlocked: prerequisiteSatisfied }
  })
}
