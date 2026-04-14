import { getCommanderLevelProgress, xpToLevel } from '~/utils/commanderExperience'
import { formatPlayerName } from '~/utils/playerNames'
import {
  computeGlobalCommanderBaseline,
  computePlayerCommanderTier,
  getTierProgress,
} from '~/utils/tiers'
import {
  type CommanderState,
  compareGamesChronological,
  type PlayerGameRecord,
  type PlayerState,
  type ProcessedGame,
} from '~/composables/useLeagueState'

type SuggestionTone = 'rotation' | 'specialize' | 'expand' | 'achievement' | 'stability'

interface CommanderSnapshot {
  name: string
  plays: number
  wins: number
  winRate: number
  avgFinalPoints: number
  avgPlacement: number
  recentPlays: number
  recentWins: number
  recentWinRate: number
  recentAvgFinalPoints: number
  recentAvgPlacement: number
  xp: number
  level: number
}

export interface PlayerSuggestion {
  tone: SuggestionTone
  title: string
  summary: string
  reasons: string[]
}

export interface PlayerCommanderPickSuggestion {
  commander: string
  focus: 'xp' | 'achievement' | 'multiplier'
  title: string
  summary: string
}

export function buildPlayerSuggestion(
  playerName: string,
  games: ProcessedGame[],
  gameRecords: Record<string, Record<string, PlayerGameRecord>>,
  players: Record<string, PlayerState>,
): PlayerSuggestion | null {
  const player = players[playerName]
  if (!player) return null

  const orderedRecords = buildOrderedRecords(playerName, games, gameRecords)
  if (orderedRecords.length === 0) return null

  const recentRecords = orderedRecords.slice(-10)
  const recentCommanderCounts = countCommanders(recentRecords)
  const commanderSnapshots = buildCommanderSnapshots(playerName, orderedRecords, recentRecords, players)
  const overallAvg = round3(orderedRecords.reduce((sum, record) => sum + record.finalPoints, 0) / orderedRecords.length)
  const recentAvg = recentRecords.length > 0
    ? round3(recentRecords.reduce((sum, record) => sum + record.finalPoints, 0) / recentRecords.length)
    : overallAvg
  const overallWinRate = orderedRecords.filter((record) => record.placement === 1).length / orderedRecords.length
  const recentWinRate = recentRecords.length > 0
    ? recentRecords.filter((record) => record.placement === 1).length / recentRecords.length
    : overallWinRate
  const uniqueCommanders = commanderSnapshots.length
  const topPlayedCommander = [...commanderSnapshots].sort((a, b) => b.plays - a.plays || a.name.localeCompare(b.name))[0] ?? null
  const bestCommander = [...commanderSnapshots]
    .filter((snapshot) => snapshot.plays >= 3)
    .sort((a, b) => b.avgFinalPoints - a.avgFinalPoints || a.avgPlacement - b.avgPlacement)[0] ?? null
  const recentMostPickedName = [...recentCommanderCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null
  const recentMostPicked = recentMostPickedName
    ? commanderSnapshots.find((snapshot) => snapshot.name === recentMostPickedName) ?? null
    : null
  const recentUniqueCommanders = recentCommanderCounts.size
  const recentNewCommanderCount = commanderSnapshots
    .filter((snapshot) => snapshot.recentPlays > 0 && snapshot.plays <= 2)
    .length
  const baseContribution = player.totalPoints + player.achievementPoints
  const achievementShare = baseContribution > 0 ? player.achievementPoints / baseContribution : 0

  const candidates = [
    buildMonoCommanderSuggestion(topPlayedCommander, uniqueCommanders, orderedRecords.length, overallAvg),
    buildOverRotationSuggestion(
      recentUniqueCommanders,
      recentNewCommanderCount,
      recentAvg,
      overallAvg,
      recentWinRate,
      overallWinRate,
      recentRecords.length,
      bestCommander,
    ),
    buildColdCommanderSuggestion(recentMostPicked, bestCommander, overallAvg, overallWinRate, recentRecords.length),
    buildReturnToStrengthSuggestion(
      bestCommander,
      topPlayedCommander,
      recentMostPicked,
      overallAvg,
      uniqueCommanders,
      recentRecords.length,
    ),
    buildExpandPoolSuggestion(topPlayedCommander, bestCommander, uniqueCommanders, overallAvg, orderedRecords.length),
    buildAchievementConversionSuggestion(player, overallAvg, overallWinRate, achievementShare),
  ].filter((candidate): candidate is { score: number; suggestion: PlayerSuggestion } => candidate !== null)

  if (candidates.length === 0) {
    const anchorCommander = bestCommander ?? topPlayedCommander
    return {
      tone: 'stability',
      title: 'Keep building your most stable line',
      summary: anchorCommander
        ? `${formatPlayerName(anchorCommander.name)} is still your clearest baseline. Use it as the anchor while adjusting around your recent form.`
        : 'Your recent results are fairly balanced, so the best next step is to keep building consistency from game to game.',
      reasons: [
        `Overall average is ${fmt(overallAvg)} points per game across ${orderedRecords.length} games.`,
        `Recent form is spread across ${uniqueCommanders} commanders, so there is no single leak dominating the results right now.`,
      ],
    }
  }

  return candidates.sort((a, b) => b.score - a.score)[0]?.suggestion ?? null
}

export function buildPlayerCommanderPickSuggestions(
  playerName: string,
  games: ProcessedGame[],
  gameRecords: Record<string, Record<string, PlayerGameRecord>>,
  players: Record<string, PlayerState>,
  commanders: Record<string, CommanderState>,
) {
  const player = players[playerName]
  if (!player) return []

  const orderedRecords = buildOrderedRecords(playerName, games, gameRecords)
  if (orderedRecords.length === 0) return []

  const overallAvg = round3(orderedRecords.reduce((sum, record) => sum + record.finalPoints, 0) / orderedRecords.length)
  const overallWinRate = orderedRecords.filter((record) => record.placement === 1).length / orderedRecords.length
  const recentRecords = orderedRecords.slice(-10)
  const recordsByCommander = groupByCommander(orderedRecords)
  const commanderSnapshots = buildCommanderSnapshots(playerName, orderedRecords, recentRecords, players)
  const coolingOffCommanders = new Set(
    commanderSnapshots
      .filter((snapshot) => isCoolingOffForSuggestions(snapshot, overallAvg, overallWinRate))
      .map((snapshot) => snapshot.name),
  )
  const earnedByCommander = new Map<string, Set<string>>()

  for (const achievement of player.earnedAchievements ?? []) {
    if (!achievement.commander) continue
    const bucket = earnedByCommander.get(achievement.commander)
    if (bucket) bucket.add(achievement.id)
    else earnedByCommander.set(achievement.commander, new Set([achievement.id]))
  }

  const globalBaseline = computeGlobalCommanderBaseline(commanders)

  const scored = [...recordsByCommander.entries()]
    .filter(([commander]) => !coolingOffCommanders.has(commander))
    .map(([commander, records]) => buildCommanderPickCandidate(
      commander,
      records,
      orderedRecords,
      overallAvg,
      player,
      earnedByCommander.get(commander) ?? new Set<string>(),
      globalBaseline,
    ))
    .filter((entry): entry is CommanderPickCandidate => Boolean(entry))
    .sort((a, b) => b.score - a.score || a.commander.localeCompare(b.commander))

  return scored.slice(0, 3).map(({ score: _score, ...suggestion }) => suggestion)
}

function isCoolingOffForSuggestions(
  snapshot: CommanderSnapshot,
  overallAvg: number,
  overallWinRate: number,
) {
  if (snapshot.recentPlays < 4) return false

  const selfDecline = snapshot.avgFinalPoints - snapshot.recentAvgFinalPoints
  const recentVsPlayerAvgGap = overallAvg - snapshot.recentAvgFinalPoints
  const winGap = snapshot.winRate - snapshot.recentWinRate
  const recentVsPlayerWinGap = overallWinRate - snapshot.recentWinRate
  const placementDrop = snapshot.recentAvgPlacement - snapshot.avgPlacement

  return selfDecline >= 0.08
    || recentVsPlayerAvgGap >= 0.12
    || winGap >= 0.1
    || recentVsPlayerWinGap >= 0.12
    || placementDrop >= 0.25
}

function buildMonoCommanderSuggestion(
  topPlayedCommander: CommanderSnapshot | null,
  uniqueCommanders: number,
  totalGames: number,
  overallAvg: number,
) {
  if (!topPlayedCommander) return null
  if (totalGames < 6 || uniqueCommanders > 2) return null

  const topShare = topPlayedCommander.plays / totalGames
  if (topShare < 0.8) return null

  return {
    score: 1 + topShare + ((3 - uniqueCommanders) * 0.15),
    suggestion: {
      tone: 'expand',
      title: 'Try out more new commanders',
      summary: `Most of your reps are concentrated on ${formatPlayerName(topPlayedCommander.name)}. Branching out would add easy XP growth and give you more ways to score without needing a huge performance jump first.`,
      reasons: [
        `${formatPlayerName(topPlayedCommander.name)} accounts for ${Math.round(topShare * 100)}% of your ${totalGames} games so far.`,
        `You have only used ${uniqueCommanders} commander${uniqueCommanders === 1 ? '' : 's'}, so a lot of level and achievement upside is still untouched.`,
        `Your current baseline is ${fmt(overallAvg)} points per game, so new reps can still pay off even before they become top-tier performers.`,
      ],
    },
  }
}

function buildOverRotationSuggestion(
  recentUniqueCommanders: number,
  recentNewCommanderCount: number,
  recentAvg: number,
  overallAvg: number,
  recentWinRate: number,
  overallWinRate: number,
  recentGames: number,
  bestCommander: CommanderSnapshot | null,
) {
  if (recentGames < 6) return null

  const avgDrop = overallAvg - recentAvg
  const winRateDrop = overallWinRate - recentWinRate
  const bestEdge = bestCommander
    ? Math.max(bestCommander.avgFinalPoints - overallAvg, 0) + Math.max(bestCommander.winRate - overallWinRate, 0)
    : 0
  if (recentUniqueCommanders < 3 || recentNewCommanderCount < 2) return null
  if (avgDrop < 0.02 && winRateDrop < 0.04) return null
  if (!bestCommander || bestCommander.plays < 3 || bestEdge < 0.08) return null

  return {
    score: 0.45 + avgDrop + winRateDrop + bestEdge + (recentUniqueCommanders * 0.09) + (recentNewCommanderCount * 0.1),
    suggestion: {
      tone: 'stability',
      title: 'Focus more on your stronger commanders',
      summary: 'You are lowering your win rate by feeding too many recent reps into new commanders. Leaning back into your stronger, more successful commanders should raise both floor and conversion rate.',
      reasons: [
        `Your last ${recentGames} games span ${recentUniqueCommanders} different commanders, with ${recentNewCommanderCount} of them still at two plays or fewer.`,
        `Recent average is ${fmt(recentAvg)} versus your overall ${fmt(overallAvg)}, and recent win rate is ${Math.round(recentWinRate * 100)}% versus ${Math.round(overallWinRate * 100)}% overall.`,
        `${formatPlayerName(bestCommander.name)} has been one of your stronger commanders at ${fmt(bestCommander.avgFinalPoints)} points per game with a ${Math.round(bestCommander.winRate * 100)}% win rate.`,
      ],
    },
  }
}

function buildColdCommanderSuggestion(
  recentMostPicked: CommanderSnapshot | null,
  bestCommander: CommanderSnapshot | null,
  overallAvg: number,
  overallWinRate: number,
  recentGames: number,
) {
  if (!recentMostPicked) return null

  const selfDecline = recentMostPicked.avgFinalPoints - recentMostPicked.recentAvgFinalPoints
  const recentVsPlayerAvgGap = overallAvg - recentMostPicked.recentAvgFinalPoints
  const winGap = recentMostPicked.winRate - recentMostPicked.recentWinRate
  const recentVsPlayerWinGap = overallWinRate - recentMostPicked.recentWinRate
  const placementDrop = recentMostPicked.recentAvgPlacement - recentMostPicked.avgPlacement

  if (
    recentMostPicked.recentPlays < 4
    || (
      selfDecline < 0.08
      && recentVsPlayerAvgGap < 0.12
      && winGap < 0.1
      && recentVsPlayerWinGap < 0.12
      && placementDrop < 0.25
    )
  ) return null

  const reasons = [
    `${formatPlayerName(recentMostPicked.name)} has been your most-played commander in the last ${recentGames} games (${recentMostPicked.recentPlays} picks).`,
    `Its recent average is ${fmt(recentMostPicked.recentAvgFinalPoints)} versus its own long-term ${fmt(recentMostPicked.avgFinalPoints)}.`,
    `Recent win rate is ${Math.round(recentMostPicked.recentWinRate * 100)}% versus ${Math.round(recentMostPicked.winRate * 100)}% overall.`,
  ]

  if (bestCommander && bestCommander.name !== recentMostPicked.name) {
    reasons.push(`${formatPlayerName(bestCommander.name)} has been stronger for you overall at ${fmt(bestCommander.avgFinalPoints)} points per game.`)
  }

  return {
    score: selfDecline + winGap + Math.max(placementDrop, 0) + (recentMostPicked.recentPlays * 0.03),
    suggestion: {
      tone: 'rotation',
      title: `Turn focus away from ${formatPlayerName(recentMostPicked.name)}`,
      summary: `${formatPlayerName(recentMostPicked.name)} is slipping relative to its own earlier standard, and the recent reps are not paying off. Shifting away from it now is the clearest way to stop the slide.`,
      reasons,
    },
  }
}

function buildReturnToStrengthSuggestion(
  bestCommander: CommanderSnapshot | null,
  topPlayedCommander: CommanderSnapshot | null,
  recentMostPicked: CommanderSnapshot | null,
  overallAvg: number,
  uniqueCommanders: number,
  recentGames: number,
) {
  if (!bestCommander) return null
  if (bestCommander.recentPlays > 1) return null

  const advantage = bestCommander.avgFinalPoints - overallAvg
  const comparisonCommander = recentMostPicked ?? topPlayedCommander
  const focusGap = comparisonCommander && comparisonCommander.name !== bestCommander.name
    ? bestCommander.avgFinalPoints - comparisonCommander.avgFinalPoints
    : 0
  if (advantage < 0.15) return null
  if (uniqueCommanders < 3 && focusGap < 0.12) return null

  return {
    score: advantage + Math.max(focusGap, 0) + (uniqueCommanders * 0.03),
    suggestion: {
      tone: 'specialize',
      title: `Bring ${formatPlayerName(bestCommander.name)} back into the mix`,
      summary: `${formatPlayerName(bestCommander.name)} has been one of your strongest commanders, but it barely showed up in your last ${recentGames} games.`,
      reasons: [
        `${formatPlayerName(bestCommander.name)} averages ${fmt(bestCommander.avgFinalPoints)} points per game versus your overall ${fmt(overallAvg)}.`,
        comparisonCommander && comparisonCommander.name !== bestCommander.name
          ? `You are currently spending more reps on ${formatPlayerName(comparisonCommander.name)}, which has not been as efficient for you.`
          : `Your recent games are spread widely enough that a proven strength may be getting lost.`,
      ],
    },
  }
}

function buildExpandPoolSuggestion(
  topPlayedCommander: CommanderSnapshot | null,
  bestCommander: CommanderSnapshot | null,
  uniqueCommanders: number,
  overallAvg: number,
  totalGames: number,
) {
  if (!topPlayedCommander) return null

  const topShare = topPlayedCommander.plays / totalGames
  const isPlateauing = topPlayedCommander.avgFinalPoints <= overallAvg + 0.05
  const isHighLevel = topPlayedCommander.level >= 12

  if (topShare < 0.42 || !isPlateauing || !isHighLevel) return null

  const reasons = [
    `${formatPlayerName(topPlayedCommander.name)} accounts for ${Math.round(topShare * 100)}% of your games and is already level ${topPlayedCommander.level}.`,
    `Its average output (${fmt(topPlayedCommander.avgFinalPoints)}) is close to your overall baseline (${fmt(overallAvg)}), so extra reps are not creating a big edge right now.`,
  ]

  if (bestCommander && bestCommander.name !== topPlayedCommander.name) {
    reasons.push(`${formatPlayerName(bestCommander.name)} has given you better returns, so mixing it back in could improve both results and progression upside.`)
  } else {
    reasons.push(`A broader pool gives you more chances at fresh XP gains and commander-specific achievements without sacrificing much current output.`)
  }

  return {
    score: topShare + (topPlayedCommander.level * 0.01),
    suggestion: {
      tone: 'expand',
      title: 'Open your commander pool again',
      summary: `You are leaning hard on ${formatPlayerName(topPlayedCommander.name)}, but the results look more flat than dominant. Rotating a second option is likely worth it.`,
      reasons,
    },
  }
}

function buildAchievementConversionSuggestion(
  player: PlayerState,
  overallAvg: number,
  overallWinRate: number,
  achievementShare: number,
) {
  if (achievementShare < 0.22) return null
  if (overallAvg >= 0.72 && overallWinRate >= 0.22) return null

  return {
    score: achievementShare + Math.max(0, 0.22 - overallWinRate),
    suggestion: {
      tone: 'achievement',
      title: 'Turn your achievement edge into steadier finishes',
      summary: 'You are already extracting a lot of value from achievements. The next jump probably comes from improving baseline placements, not from chasing even more side points.',
      reasons: [
        `Achievement points make up ${Math.round(achievementShare * 100)}% of your points-plus-achievements base.`,
        `Your game-point average is ${fmt(overallAvg)}, so slightly stronger finishes would multiply the value of the achievement points you already earn.`,
      ],
    },
  }
}

function buildCommanderSnapshots(
  playerName: string,
  orderedRecords: PlayerGameRecord[],
  recentRecords: PlayerGameRecord[],
  players: Record<string, PlayerState>,
) {
  const recentByCommander = groupByCommander(recentRecords)
  const allByCommander = groupByCommander(orderedRecords)
  const xpMap = players[playerName]?.commanderXP ?? {}

  return [...allByCommander.entries()].map(([commanderName, records]) => {
    const wins = records.filter((record) => record.placement === 1).length
    const avgFinalPoints = round3(records.reduce((sum, record) => sum + record.finalPoints, 0) / records.length)
    const avgPlacement = round3(records.reduce((sum, record) => sum + record.placement, 0) / records.length)
    const recent = recentByCommander.get(commanderName) ?? []
    const recentWins = recent.filter((record) => record.placement === 1).length
    const xp = xpMap[commanderName] ?? 0

    return {
      name: commanderName,
      plays: records.length,
      wins,
      winRate: toRate(wins, records.length),
      avgFinalPoints,
      avgPlacement,
      recentPlays: recent.length,
      recentWins,
      recentWinRate: toRate(recentWins, recent.length),
      recentAvgFinalPoints: recent.length > 0
        ? round3(recent.reduce((sum, record) => sum + record.finalPoints, 0) / recent.length)
        : avgFinalPoints,
      recentAvgPlacement: recent.length > 0
        ? round3(recent.reduce((sum, record) => sum + record.placement, 0) / recent.length)
        : avgPlacement,
      xp,
      level: xpToLevel(xp),
    }
  })
}

type CommanderPickCandidate = PlayerCommanderPickSuggestion & { score: number }

function buildCommanderPickCandidate(
  commander: string,
  records: PlayerGameRecord[],
  orderedRecords: PlayerGameRecord[],
  overallAvg: number,
  player: PlayerState,
  earnedIds: Set<string>,
  globalBaseline: number,
): CommanderPickCandidate | null {
  const plays = records.length
  if (plays === 0) return null

  const recentRecords = records.slice(-Math.min(5, records.length))
  const avgFinalPoints = round3(records.reduce((sum, record) => sum + record.finalPoints, 0) / plays)
  const recentAvg = round3(recentRecords.reduce((sum, record) => sum + record.finalPoints, 0) / recentRecords.length)
  const avgPlacement = round3(records.reduce((sum, record) => sum + record.placement, 0) / plays)
  const wins = records.filter((record) => record.placement === 1).length
  const avgXpGain = round3(records.reduce((sum, record) => sum + (record.commanderXpAfter - record.commanderXpBefore), 0) / plays)
  const xp = player.commanderXP?.[commander] ?? 0
  const levelProgress = getCommanderLevelProgress(xp)
  const avgEdge = avgFinalPoints - overallAvg
  const recentEdge = recentAvg - overallAvg
  const gamesSinceLastPlayed = getGamesSinceLastPlayed(orderedRecords, commander)
  const trailingWins = countTrailingWins(records)

  const stabilityCandidate = buildStabilityPickCandidate(commander, avgFinalPoints, recentAvg, avgEdge, recentEdge, plays)
  const xpCandidate = buildXpPickCandidate(
    commander,
    levelProgress.xpToNext,
    avgXpGain,
    avgFinalPoints,
    recentAvg,
    overallAvg,
    levelProgress.level,
  )
  const achievementCandidate = buildAchievementPickCandidate(
    commander,
    records,
    wins,
    avgFinalPoints,
    recentAvg,
    avgPlacement,
    overallAvg,
    earnedIds,
    globalBaseline,
  )
  const forgottenFriendCandidate = buildForgottenFriendPickCandidate(
    commander,
    gamesSinceLastPlayed,
    avgFinalPoints,
    recentAvg,
    overallAvg,
  )
  const winStreakCandidate = buildWinStreakPickCandidate(
    commander,
    trailingWins,
    avgFinalPoints,
    recentAvg,
    overallAvg,
  )
  const comebackCandidate = buildComebackPickCandidate(
    commander,
    gamesSinceLastPlayed,
    avgEdge,
    recentEdge,
    plays,
  )
  const levelAchievementCandidate = buildLevelAchievementPickCandidate(
    commander,
    levelProgress.level,
    levelProgress.xpToNext,
    avgXpGain,
    avgFinalPoints,
    recentAvg,
    overallAvg,
    earnedIds,
  )

  return [
    stabilityCandidate,
    xpCandidate,
    achievementCandidate,
    forgottenFriendCandidate,
    winStreakCandidate,
    comebackCandidate,
    levelAchievementCandidate,
  ]
    .filter((entry): entry is CommanderPickCandidate => Boolean(entry))
    .sort((a, b) => b.score - a.score)[0] ?? null
}

function buildStabilityPickCandidate(
  commander: string,
  avgFinalPoints: number,
  recentAvg: number,
  avgEdge: number,
  recentEdge: number,
  plays: number,
): CommanderPickCandidate | null {
  if (plays < 3) return null
  if (avgEdge < 0.05 && recentEdge < 0.03) return null

  return {
    commander,
    focus: 'multiplier',
    title: 'Best bet for steady points',
    summary: `${commander} is one of this player’s safest scoring picks: ${fmt(avgFinalPoints)} average overall and ${fmt(recentAvg)} over the last few runs.`,
    score: avgEdge + Math.max(recentEdge, 0) + Math.min(plays, 8) * 0.015,
  }
}

function buildXpPickCandidate(
  commander: string,
  xpToNext: number,
  avgXpGain: number,
  avgFinalPoints: number,
  recentAvg: number,
  overallAvg: number,
  level: number,
): CommanderPickCandidate | null {
  if (xpToNext <= 0 || avgXpGain <= 0) return null
  const gamesToLevel = xpToNext / avgXpGain
  const performanceFloor = Math.max(avgFinalPoints, recentAvg)
  if (gamesToLevel > 2.5 || performanceFloor < overallAvg - 0.05) return null

  return {
    commander,
    focus: 'xp',
    title: 'Fastest XP upside',
    summary: `${commander} is close to the next level. At the current XP pace, it is roughly ${fmt(round3(gamesToLevel))} games away while still holding a solid scoring baseline.`,
    score: (1 / Math.max(gamesToLevel, 0.5)) + Math.max(performanceFloor - overallAvg, 0) + level * 0.01,
  }
}

function buildAchievementPickCandidate(
  commander: string,
  records: PlayerGameRecord[],
  wins: number,
  avgFinalPoints: number,
  recentAvg: number,
  avgPlacement: number,
  overallAvg: number,
  earnedIds: Set<string>,
  globalBaseline: number,
): CommanderPickCandidate | null {
  const hasPlayableAchievementProfile = recentAvg >= overallAvg - 0.08
    && avgFinalPoints >= overallAvg - 0.1
    && avgPlacement <= 2.9

  if (!earnedIds.has('first_blood') && wins === 0 && hasPlayableAchievementProfile) {
    return {
      commander,
      focus: 'achievement',
      title: 'Most likely to cash in an achievement soon',
      summary: `${commander} still has First Blood available. One win would add the achievement while the scoring profile is already close to this player’s baseline.`,
      score: 0.9 + Math.max(avgFinalPoints - overallAvg, 0),
    }
  }

  if (globalBaseline <= 0) return null

  const { detail, context } = computePlayerCommanderTier(records, globalBaseline)
  if (!detail) return null

  const progress = getTierProgress(detail, context)
  if (!progress.riseGames || progress.riseGames > 2 || !progress.riseTarget) return null
  if (!hasPlayableAchievementProfile) return null

  const targetTier = progress.riseTarget.split(' ')[0]?.trim().toLowerCase()
  const achievementId =
    targetTier === 'gold' ? 'gold_tier'
      : targetTier === 'platinum' ? 'platinum_tier'
        : targetTier === 'diamond' ? 'diamond_tier'
          : targetTier === 'legend' ? 'legend_tier'
            : targetTier === 'god' ? 'god_tier'
          : null

  if (!achievementId || earnedIds.has(achievementId)) return null

  return {
    commander,
    focus: 'achievement',
    title: 'Closest to a tier achievement',
    summary: `${commander} is within about ${progress.riseGames} strong game${progress.riseGames === 1 ? '' : 's'} of reaching ${progress.riseTarget}, which would unlock another commander achievement.`,
    score: 0.8 + (1 / progress.riseGames) + Math.max(avgFinalPoints - overallAvg, 0),
  }
}

function buildForgottenFriendPickCandidate(
  commander: string,
  gamesSinceLastPlayed: number,
  avgFinalPoints: number,
  recentAvg: number,
  overallAvg: number,
): CommanderPickCandidate | null {
  if (gamesSinceLastPlayed < 10) return null
  if (Math.max(avgFinalPoints, recentAvg) < overallAvg - 0.08) return null

  return {
    commander,
    focus: 'achievement',
    title: 'Free comeback achievement',
    summary: `${commander} has been untouched for ${gamesSinceLastPlayed} games. Bringing it back now would set up a Forgotten Friend achievement without asking you to force a bad pick.`,
    score: 1 + Math.min(gamesSinceLastPlayed, 14) * 0.04 + Math.max(avgFinalPoints - overallAvg, 0),
  }
}

function buildWinStreakPickCandidate(
  commander: string,
  trailingWins: number,
  avgFinalPoints: number,
  recentAvg: number,
  overallAvg: number,
): CommanderPickCandidate | null {
  if (trailingWins < 2) return null
  if (Math.max(avgFinalPoints, recentAvg) < overallAvg - 0.03) return null

  return {
    commander,
    focus: 'achievement',
    title: 'One win away from a streak',
    summary: `${commander} is already on a two-win run. One more win would convert that into a Win Streak achievement while the commander is still in form.`,
    score: 1.2 + Math.max(recentAvg - overallAvg, 0) + Math.max(avgFinalPoints - overallAvg, 0),
  }
}

function buildComebackPickCandidate(
  commander: string,
  gamesSinceLastPlayed: number,
  avgEdge: number,
  recentEdge: number,
  plays: number,
): CommanderPickCandidate | null {
  if (gamesSinceLastPlayed < 6 || plays < 3) return null
  if (avgEdge < 0.08 && recentEdge < 0.05) return null

  return {
    commander,
    focus: 'multiplier',
    title: 'Strong commander worth revisiting',
    summary: `${commander} has drifted out of the rotation, but it still looks like one of the playerâ€™s cleaner point engines.`,
    score: 0.75 + avgEdge + Math.max(recentEdge, 0) + Math.min(gamesSinceLastPlayed, 10) * 0.03 + Math.min(plays, 8) * 0.01,
  }
}

function buildLevelAchievementPickCandidate(
  commander: string,
  level: number,
  xpToNext: number,
  avgXpGain: number,
  avgFinalPoints: number,
  recentAvg: number,
  overallAvg: number,
  earnedIds: Set<string>,
): CommanderPickCandidate | null {
  if (avgXpGain <= 0) return null
  if (Math.max(avgFinalPoints, recentAvg) < overallAvg - 0.05) return null

  const milestone =
    level === 6 && !earnedIds.has('reach_level_7') ? 'level 7'
      : level === 9 && !earnedIds.has('reach_level_10') ? 'level 10'
        : level === 19 && !earnedIds.has('reach_level_20') ? 'level 20'
          : null

  if (!milestone) return null

  const gamesToMilestone = xpToNext / avgXpGain
  if (gamesToMilestone > 3) return null

  return {
    commander,
    focus: 'achievement',
    title: 'Close to a level milestone',
    summary: `${commander} is about ${fmt(round3(gamesToMilestone))} games away from ${milestone}, which would unlock another commander achievement.`,
    score: 0.95 + (1 / Math.max(gamesToMilestone, 0.75)) + Math.max(avgFinalPoints - overallAvg, 0),
  }
}

function getGamesSinceLastPlayed(
  orderedRecords: PlayerGameRecord[],
  commander: string,
) {
  for (let index = orderedRecords.length - 1; index >= 0; index--) {
    if (orderedRecords[index]?.commander === commander) {
      return (orderedRecords.length - 1) - index
    }
  }

  return orderedRecords.length
}

function countTrailingWins(records: PlayerGameRecord[]) {
  let count = 0

  for (let index = records.length - 1; index >= 0; index--) {
    if (records[index]?.placement !== 1) break
    count++
  }

  return count
}

function buildOrderedRecords(
  playerName: string,
  games: ProcessedGame[],
  gameRecords: Record<string, Record<string, PlayerGameRecord>>,
) {
  const orderedGames = [...games].sort(compareGamesChronological)
  const records = gameRecords[playerName] ?? {}

  return orderedGames
    .map((game) => records[game.gameId])
    .filter((record): record is PlayerGameRecord => Boolean(record))
}

function groupByCommander(records: PlayerGameRecord[]) {
  const grouped = new Map<string, PlayerGameRecord[]>()

  for (const record of records) {
    const bucket = grouped.get(record.commander)
    if (bucket) bucket.push(record)
    else grouped.set(record.commander, [record])
  }

  return grouped
}

function countCommanders(records: PlayerGameRecord[]) {
  const counts = new Map<string, number>()

  for (const record of records) {
    counts.set(record.commander, (counts.get(record.commander) ?? 0) + 1)
  }

  return counts
}

function toRate(value: number, total: number) {
  return total > 0 ? value / total : 0
}

function round3(value: number) {
  return Math.round(value * 1000) / 1000
}

function fmt(value: number) {
  return value % 1 === 0 ? String(value) : value.toFixed(3).replace(/\.?0+$/, '')
}
