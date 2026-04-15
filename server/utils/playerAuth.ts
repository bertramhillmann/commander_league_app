import { randomUUID } from 'node:crypto'
import type { H3Event } from 'h3'
import { getCookie, setCookie } from 'h3'

type SessionRecord = {
  user: string
  expiresAt: number
}

export type PlayerLoginEntry = {
  username: string
  password: string
}

const SESSION_COOKIE = 'cmd_auth_session'
const SESSION_TTL_MS = 5 * 24 * 60 * 60 * 1000
const sessions = new Map<string, SessionRecord>()

export function parsePlayerLogins(raw: string | undefined) {
  const logins: Record<string, PlayerLoginEntry> = {}
  if (!raw) return logins

  const bodyMatch = raw.match(/\[(.*)\]/s)
  const body = bodyMatch?.[1] ?? raw

  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trim().replace(/,$/, '')
    if (!trimmed || trimmed === '[' || trimmed === ']') continue

    const separatorIndex = trimmed.indexOf(':')
    if (separatorIndex === -1) continue

    const username = trimmed.slice(0, separatorIndex).trim()
    const password = trimmed.slice(separatorIndex + 1).trim()
    if (!username || !password) continue

    logins[username.toLowerCase()] = {
      username,
      password,
    }
  }

  return logins
}

export function validatePlayerLogin(raw: string | undefined, username: string, password: string) {
  const logins = parsePlayerLogins(raw)
  const normalizedUsername = username.trim().toLowerCase()
  return logins[normalizedUsername]?.password === password
}

export function resolvePlayerUsername(raw: string | undefined, username: string) {
  const logins = parsePlayerLogins(raw)
  const normalizedUsername = username.trim().toLowerCase()
  return logins[normalizedUsername]?.username ?? capitalizePlayerName(username)
}

export function createPlayerSession(username: string) {
  cleanupExpiredSessions()

  const token = randomUUID()
  sessions.set(token, {
    user: username.trim(),
    expiresAt: Date.now() + SESSION_TTL_MS,
  })

  return {
    token,
    maxAge: SESSION_TTL_MS / 1000,
  }
}

export function setPlayerSessionCookie(event: H3Event, token: string, maxAge: number) {
  setCookie(event, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  })
}

export function clearPlayerSessionCookie(event: H3Event) {
  const token = getCookie(event, SESSION_COOKIE)
  if (token) sessions.delete(token)

  setCookie(event, SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  })
}

export function getPlayerSession(event: H3Event) {
  cleanupExpiredSessions()

  const token = getCookie(event, SESSION_COOKIE)
  if (!token) return null

  const session = sessions.get(token)
  if (!session) return null

  if (session.expiresAt <= Date.now()) {
    sessions.delete(token)
    return null
  }

  return session
}

function cleanupExpiredSessions() {
  const now = Date.now()
  for (const [token, session] of sessions.entries()) {
    if (session.expiresAt <= now) sessions.delete(token)
  }
}

export function parseAdmins(raw: string | undefined): string[] {
  if (!raw) return []
  const bodyMatch = raw.match(/\[(.*)\]/s)
  const body = bodyMatch?.[1] ?? raw
  return body
    .split(/[,\s\r\n]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

export function isAdminUser(raw: string | undefined, username: string): boolean {
  const admins = parseAdmins(raw)
  return admins.includes(username.trim().toLowerCase())
}

function capitalizePlayerName(name: string) {
  const trimmed = name.trim()
  if (!trimmed) return trimmed
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
}
