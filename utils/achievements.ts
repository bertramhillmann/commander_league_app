import { getResolvedAchievementDefinition, getResolvedAchievementDefinitions } from '~/utils/leagueSettings'
import {
  DEFAULT_ACHIEVEMENTS,
  type AchievementDef,
} from '~/utils/scoringDefaults'

export interface EarnedAchievement {
  id: string
  /** The game this was earned in. 'post' for tier/rock-bottom achievements. */
  gameId: string
  /** For commander-scoped achievements */
  commander?: string
}

export const ACHIEVEMENTS: Record<string, AchievementDef> = DEFAULT_ACHIEVEMENTS

export function getAchievementDefinitions() {
  return getResolvedAchievementDefinitions()
}

export function getAchievementDefinition(id: string) {
  return getResolvedAchievementDefinition(id)
}
