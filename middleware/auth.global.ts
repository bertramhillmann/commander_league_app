export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path.startsWith('/admin')) return

  if (to.path === '/login') {
    return
  }

  const { ensureSession } = useAuth()
  const user = await ensureSession()

  if (!user) return navigateTo('/login')
})
