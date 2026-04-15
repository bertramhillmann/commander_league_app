export function useAuth() {
  const user = useState<string | null>('auth:user', () => null)
  const isAdmin = useState<boolean>('auth:isAdmin', () => false)
  const ready = useState<boolean>('auth:ready', () => false)

  async function refreshSession() {
    const requestFetch = process.server ? useRequestFetch() : $fetch

    try {
      const session = await requestFetch<{ authenticated: boolean; user: string | null; isAdmin: boolean }>('/api/auth/session')
      user.value = session.user
      isAdmin.value = session.isAdmin ?? false
    } catch {
      user.value = null
      isAdmin.value = false
    } finally {
      ready.value = true
    }

    return user.value
  }

  async function ensureSession() {
    if (ready.value) return user.value
    return await refreshSession()
  }

  async function login(username: string, password: string) {
    const result = await $fetch<{ ok: boolean; user: string }>('/api/auth/login', {
      method: 'POST',
      body: { username, password },
    })

    user.value = result.user
    ready.value = true
    await refreshSession()
    return result.user
  }

  async function logout() {
    try {
      await $fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      user.value = null
      isAdmin.value = false
      ready.value = true
    }
  }

  return {
    user,
    isAdmin,
    ready,
    refreshSession,
    ensureSession,
    login,
    logout,
  }
}
