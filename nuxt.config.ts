// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-04-03',
  devtools: { enabled: true },

  app: {
    head: {
      title: 'LCL 2026',
      link: [
        { rel: 'icon', type: 'image/png', href: '/favicon.png' },
      ],
    },
  },

  css: ['~/assets/styles/main.scss'],

  vite: {
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: '@use "~/assets/styles/variables.scss" as *;',
        },
      },
    },
  },

  runtimeConfig: {
    mongodbUri: process.env.MONGODB_URI,
    playerLogins: process.env.playerLogins,
    admins: process.env.admins ?? '',
    environment: process.env.environment ?? process.env.NODE_ENV ?? 'development',
    public: {
      environment: process.env.environment ?? process.env.NODE_ENV ?? 'development',
    },
  },
})
