export interface FeaturedPlayerRecord {
  gameId: string
  commander: string
  placement: number
  playerCount: number
  rankBefore?: number
  rankAfter?: number
}

export interface FeaturedPlayerSignal {
  title: string
  summary: string
  reasons: string[]
  score: number
}

export interface FeaturedPlayerCandidate extends FeaturedPlayerSignal {
  name: string
  imageUrl: string
  initials: string
}

type FeaturedPlayerOptions = {
  resolveImageUrl?: (playerName: string) => string
  requireImage?: boolean
}

export interface FeaturedPlayerBuildContext {
  allRecordsByPlayer: Record<string, Record<string, FeaturedPlayerRecord>>
  gameOrderMap: Map<string, number>
}

export function buildFeaturedPlayerCandidate(
  playerName: string,
  records: FeaturedPlayerRecord[],
  options: FeaturedPlayerOptions = {},
  context?: FeaturedPlayerBuildContext,
): FeaturedPlayerCandidate | null {
  if (records.length < 5) return null

  const signals = [
    buildWinStreakSignal(playerName, records),
    buildRecoverySignal(playerName, records),
    buildPlacementRepeatSignal(playerName, records),
    buildRotationSignal(playerName, records),
    buildComebackSignal(playerName, records),
    buildRecentlyClimbedToTopSignal(playerName, records),
    ...(context ? [
      buildDethronedKingSignal(playerName, records, context),
      buildStreakBreakerSignal(playerName, records, context),
    ] : []),
  ].filter((signal): signal is FeaturedPlayerSignal => Boolean(signal))

  if (signals.length === 0) return null

  const imageUrl = options.resolveImageUrl?.(playerName) ?? ''
  if (options.requireImage && !imageUrl) return null

  const bestSignal = signals.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))[0]

  return {
    name: playerName,
    imageUrl,
    initials: getPlayerInitials(playerName),
    ...bestSignal,
  }
}

export function getFeaturedPlayer(
  recordsByPlayer: Record<string, Record<string, FeaturedPlayerRecord>>,
  gameOrderMap: Map<string, number>,
  options: FeaturedPlayerOptions = {},
): FeaturedPlayerCandidate | null {
  return getFeaturedPlayers(recordsByPlayer, gameOrderMap, options, 1)[0] ?? null
}

export function getFeaturedPlayers(
  recordsByPlayer: Record<string, Record<string, FeaturedPlayerRecord>>,
  gameOrderMap: Map<string, number>,
  options: FeaturedPlayerOptions = {},
  limit = Number.POSITIVE_INFINITY,
): FeaturedPlayerCandidate[] {
  const context: FeaturedPlayerBuildContext = { allRecordsByPlayer: recordsByPlayer, gameOrderMap }

  const candidates = Object.entries(recordsByPlayer)
    .map(([playerName, playerRecords]) => {
      const records = Object.values(playerRecords).sort(
        (a, b) => (gameOrderMap.get(a.gameId) ?? Number.MAX_SAFE_INTEGER)
          - (gameOrderMap.get(b.gameId) ?? Number.MAX_SAFE_INTEGER),
      )

      return buildFeaturedPlayerCandidate(playerName, records, options, context)
    })
    .filter((candidate): candidate is FeaturedPlayerCandidate => Boolean(candidate))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))

  return candidates.slice(0, limit)
}

export function getFeaturedPlayerName(
  recordsByPlayer: Record<string, Record<string, FeaturedPlayerRecord>>,
  gameOrderMap: Map<string, number>,
) {
  return getFeaturedPlayer(recordsByPlayer, gameOrderMap)?.name ?? null
}

// ── Signal builders ────────────────────────────────────────────────────────────

function buildWinStreakSignal(playerName: string, records: FeaturedPlayerRecord[]) {
  const streak = countTrailing(records, (record) => record.placement === 1)
  if (streak < 3) return null

  return {
    title: streak >= 5 ? 'On a heater' : 'Win streak rolling',
    summary: `${playerName} has stacked ${streak} straight wins and is forcing the league to pay attention.`,
    reasons: [
      `${streak} consecutive 1st-place finishes.`,
      `Latest commander: ${records[records.length - 1]?.commander}.`,
    ],
    score: 88 + (streak * 6),
  }
}

function buildRecoverySignal(playerName: string, records: FeaturedPlayerRecord[]) {
  if (records.length < 8) return null

  const recent = records.slice(-4)
  const prior = records.slice(-8, -4)
  const recentAvg = averagePlacement(recent)
  const priorAvg = averagePlacement(prior)
  const recentWins = recent.filter((record) => record.placement === 1).length
  const recentTopTwos = recent.filter((record) => record.placement <= 2).length
  const endedStrong = recent.at(-1)?.placement ?? Number.POSITIVE_INFINITY

  if (priorAvg - recentAvg < 0.9 || recentTopTwos < 3 || endedStrong > 2) return null

  return {
    title: 'Recovery arc',
    summary: `${playerName} is climbing out of a rough patch and the recent finishes finally look stable again.`,
    reasons: [
      `Last 4 games average ${formatNumber(recentAvg)} place, down from ${formatNumber(priorAvg)} in the 4 before.`,
      `${recentWins > 0 ? `${recentWins} recent win${recentWins === 1 ? '' : 's'}.` : `${recentTopTwos} recent top-2 finishes.`}`,
    ],
    score: 82 + Math.round((priorAvg - recentAvg) * 14),
  }
}

function buildPlacementRepeatSignal(playerName: string, records: FeaturedPlayerRecord[]) {
  const streak = countTrailingSame(records.map((record) => record.placement))
  if (streak < 5) return null

  const latestRecord = records[records.length - 1]
  const placement = latestRecord?.placement ?? 0
  const label = ordinal(placement)

  return {
    title: streak >= 10 ? 'Locked in one lane' : 'Same finish, every time',
    summary: `${playerName} has landed in ${label} place ${streak} games in a row. That kind of pattern is impossible to ignore.`,
    reasons: [
      `${streak} consecutive ${label}-place finishes.`,
      placement === latestRecord?.playerCount
        ? 'It is a cold streak, but it is unbelievably consistent.'
        : 'The finish band has stayed almost perfectly fixed lately.',
    ],
    score: 70 + (streak * 5),
  }
}

function buildRotationSignal(playerName: string, records: FeaturedPlayerRecord[]) {
  const streak = countTrailingNoRepeatCommander(records)
  if (streak < 10) return null

  const uniqueCount = new Set(records.slice(-streak).map((record) => record.commander)).size

  return {
    title: 'Rotation machine',
    summary: `${playerName} refuses to run it back, cycling through commander picks without repeating the last choice.`,
    reasons: [
      `${streak} straight games without picking the same commander twice in a row.`,
      `${uniqueCount} unique commanders across that run.`,
    ],
    score: 74 + Math.min(24, streak * 2),
  }
}

function buildComebackSignal(playerName: string, records: FeaturedPlayerRecord[]): FeaturedPlayerSignal | null {
  if (records.length < 6) return null

  const lastRecord = records[records.length - 1]
  if (lastRecord?.placement !== 1) return null

  let droughtLength = 0
  for (let i = records.length - 2; i >= 0; i--) {
    if (records[i].placement !== 1) droughtLength++
    else break
  }

  if (droughtLength < 5) return null

  return {
    title: droughtLength >= 10 ? 'Back from the dead' : 'The comeback',
    summary: `${playerName} finally snapped a ${droughtLength}-game winless run, picking up a win right when it mattered most.`,
    reasons: [
      `${droughtLength} consecutive games without a win.`,
      `Broke through with ${lastRecord.commander}.`,
    ],
    score: 80 + Math.min(18, droughtLength * 2),
  }
}

function buildRecentlyClimbedToTopSignal(playerName: string, records: FeaturedPlayerRecord[]): FeaturedPlayerSignal | null {
  if (records.length < 2) return null

  const recent = records.slice(-3)

  for (let i = recent.length - 1; i >= 0; i--) {
    const record = recent[i]
    const rankAfter = record.rankAfter
    const rankBefore = record.rankBefore

    if (rankAfter !== 1 || rankBefore === undefined || rankBefore <= 1) continue

    const globalIndex = records.lastIndexOf(record)
    const wasEverFirst = records.slice(0, globalIndex).some((r) => r.rankAfter === 1)

    return {
      title: wasEverFirst ? 'Back on the throne' : 'First time at the top',
      summary: wasEverFirst
        ? `${playerName} climbed back to the top spot after sitting at rank ${rankBefore}.`
        : `${playerName} reached the summit for the first time, claiming the league's number one spot.`,
      reasons: [
        `Jumped from rank ${rankBefore} to rank 1.`,
        wasEverFirst ? 'Reclaimed the top position.' : 'First time leading the league.',
      ],
      score: wasEverFirst ? 86 : 96,
    }
  }

  return null
}

function buildDethronedKingSignal(
  playerName: string,
  records: FeaturedPlayerRecord[],
  context: FeaturedPlayerBuildContext,
): FeaturedPlayerSignal | null {
  const recentWins = records.slice(-5).filter((r) => r.placement === 1)

  for (let i = recentWins.length - 1; i >= 0; i--) {
    const winRecord = recentWins[i]

    for (const [otherName, otherRecords] of Object.entries(context.allRecordsByPlayer)) {
      if (otherName === playerName) continue
      const otherGameRecord = otherRecords[winRecord.gameId]
      if (!otherGameRecord) continue

      const kingRankBefore = otherGameRecord.rankBefore
      const kingRankAfter = otherGameRecord.rankAfter

      if (kingRankBefore === 1 && kingRankAfter !== undefined && kingRankAfter > 1) {
        return {
          title: 'Killing the king',
          summary: `${playerName} won a game with league leader ${otherName} at the table, sending the king down a rank.`,
          reasons: [
            `${otherName} entered the game at rank 1.`,
            `${otherName} dropped to rank ${kingRankAfter} after this result.`,
          ],
          score: 92,
        }
      }
    }
  }

  return null
}

function buildStreakBreakerSignal(
  playerName: string,
  records: FeaturedPlayerRecord[],
  context: FeaturedPlayerBuildContext,
): FeaturedPlayerSignal | null {
  const recentWins = records.slice(-5).filter((r) => r.placement === 1)

  for (let i = recentWins.length - 1; i >= 0; i--) {
    const winRecord = recentWins[i]
    const winGameOrder = context.gameOrderMap.get(winRecord.gameId) ?? Number.MAX_SAFE_INTEGER

    for (const [otherName, otherRecords] of Object.entries(context.allRecordsByPlayer)) {
      if (otherName === playerName) continue
      if (!otherRecords[winRecord.gameId]) continue

      const theirPriorRecords = Object.values(otherRecords)
        .filter((r) => (context.gameOrderMap.get(r.gameId) ?? Number.MAX_SAFE_INTEGER) < winGameOrder)
        .sort(
          (a, b) =>
            (context.gameOrderMap.get(a.gameId) ?? 0) - (context.gameOrderMap.get(b.gameId) ?? 0),
        )

      const streak = countTrailing(theirPriorRecords, (r) => r.placement === 1)

      if (streak >= 3) {
        return {
          title: 'Streak snapper',
          summary: `${playerName} put a stop to ${otherName}'s ${streak}-game win run with a well-timed victory.`,
          reasons: [
            `${otherName} had won ${streak} games in a row going in.`,
            `A win at exactly the right moment.`,
          ],
          score: 84 + Math.min(12, streak * 2),
        }
      }
    }
  }

  return null
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function getPlayerInitials(playerName: string) {
  return playerName
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2) || playerName.slice(0, 2).toUpperCase()
}

function countTrailing<T>(items: T[], predicate: (item: T) => boolean) {
  let count = 0
  for (let index = items.length - 1; index >= 0; index--) {
    if (!predicate(items[index])) break
    count++
  }
  return count
}

function countTrailingSame(values: number[]) {
  if (values.length === 0) return 0
  const target = values[values.length - 1]
  return countTrailing(values, (value) => value === target)
}

function countTrailingNoRepeatCommander(records: FeaturedPlayerRecord[]) {
  if (records.length === 0) return 0
  let count = 1
  for (let index = records.length - 1; index > 0; index--) {
    if (records[index].commander === records[index - 1].commander) break
    count++
  }
  return count
}

function averagePlacement(records: FeaturedPlayerRecord[]) {
  if (records.length === 0) return 0
  return records.reduce((sum, record) => sum + record.placement, 0) / records.length
}

function ordinal(value: number) {
  if (value % 100 >= 11 && value % 100 <= 13) return `${value}th`
  const suffix = value % 10 === 1 ? 'st' : value % 10 === 2 ? 'nd' : value % 10 === 3 ? 'rd' : 'th'
  return `${value}${suffix}`
}

function formatNumber(value: number) {
  if (value === 0) return '0'
  return value % 1 === 0 ? String(value) : value.toFixed(3).replace(/\.?0+$/, '')
}
