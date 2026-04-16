<template>
  <div class="login-page">
    <div class="login-bubbles" aria-hidden="true">
      <span class="bubble bubble--1" />
      <span class="bubble bubble--2" />
      <span class="bubble bubble--3" />
      <span class="bubble bubble--4" />
      <span class="bubble bubble--5" />
      <span class="bubble bubble--6" />
    </div>

    <div class="login-card">
      <h1 class="login-card__title">Login</h1>
      <p class="login-card__subtitle">Enter your player credentials to continue to the dashboard.</p>

      <form class="login-card__form" @submit.prevent="submit">
        <label class="login-card__field">
          <span class="login-card__label">Username</span>
          <input v-model="username" class="login-card__input" autocomplete="username" />
        </label>

        <label class="login-card__field">
          <span class="login-card__label">Password</span>
          <input v-model="password" type="password" class="login-card__input" autocomplete="current-password" />
        </label>

        <p v-if="errorMessage" class="login-card__error">{{ errorMessage }}</p>

        <button type="submit" class="login-card__submit" :disabled="submitting">
          {{ submitting ? 'Signing In...' : 'Sign In' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
const username = ref('')
const password = ref('')
const errorMessage = ref('')
const submitting = ref(false)

const { ensureSession, login } = useAuth()

onMounted(async () => {
  const user = await ensureSession()
  if (user) {
    await navigateTo('/dashboard')
  }
})

async function submit() {
  errorMessage.value = ''
  submitting.value = true

  try {
    await login(username.value, password.value)
    await navigateTo('/dashboard')
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage ?? error?.statusMessage ?? 'Login failed'
  } finally {
    submitting.value = false
  }
}
</script>

<style lang="scss" scoped>

body {
    background: radial-gradient(ellipse at center, rgba(12, 9, 20, 0.5) 0%, rgba(28, 18, 40, 0.9) 100%), url(/_nuxt/assets/img/grunge_bg.jpg) center top / cover fixed no-repeat;
    line-height: 1.6;
}

@keyframes bubble-drift {
  0%   { transform: translate(0, 0)         scale(1); }
  20%  { transform: translate(60px, -90px)  scale(1.12); }
  45%  { transform: translate(-50px, -60px) scale(0.90); }
  70%  { transform: translate(80px, 40px)   scale(1.08); }
  100% { transform: translate(0, 0)         scale(1); }
}

@keyframes bubble-drift-alt {
  0%   { transform: translate(0, 0)          scale(1); }
  25%  { transform: translate(-70px, 80px)   scale(1.14); }
  55%  { transform: translate(55px, -80px)   scale(0.88); }
  80%  { transform: translate(-35px, 45px)   scale(1.06); }
  100% { transform: translate(0, 0)          scale(1); }
}

@keyframes bubble-drift-slow {
  0%   { transform: translate(0, 0)          scale(1); }
  30%  { transform: translate(45px, 100px)   scale(1.10); }
  60%  { transform: translate(-75px, 30px)   scale(0.92); }
  100% { transform: translate(0, 0)          scale(1); }
}

.login-page {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  overflow: hidden;
}

.login-bubbles {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.bubble {
  position: absolute;
  border-radius: 50%;
  filter: blur(90px);

  &--1 {
    width: 500px;
    height: 500px;
    top: -12%;
    left: -10%;
    background: radial-gradient(circle at 40% 40%, #7c3fc5, #4a1a88);
    opacity: 0.28;
    animation: bubble-drift 20s ease-in-out infinite;
    z-index: 2;
  }

  &--2 {
    width: 380px;
    height: 380px;
    top: 48%;
    right: -8%;
    background: radial-gradient(circle at 60% 50%, #6c3fc5, #2a0f55);
    opacity: 0.22;
    animation: bubble-drift-alt 15s ease-in-out infinite;
    animation-delay: -5s;
  }

  &--3 {
    width: 320px;
    height: 320px;
    bottom: -6%;
    left: 18%;
    background: radial-gradient(circle at 50% 60%, #2c9c6a, #1a5c3f);
    opacity: 0.16;
    animation: bubble-drift-slow 24s ease-in-out infinite;
    animation-delay: -10s;
  }

  &--4 {
    width: 240px;
    height: 240px;
    top: 28%;
    left: 8%;
    background: radial-gradient(circle at 50% 40%, #9b6ee8, #5a2aaa);
    opacity: 0.20;
    animation: bubble-drift-alt 17s ease-in-out infinite;
    animation-delay: -3s;
  }

  &--5 {
    width: 420px;
    height: 420px;
    bottom: 8%;
    right: 4%;
    background: radial-gradient(circle at 45% 55%, #4a1a88, #1a0a30);
    opacity: 0.24;
    animation: bubble-drift-slow 22s ease-in-out infinite;
    animation-delay: -14s;
    z-index: 2;
  }

  &--6 {
    width: 190px;
    height: 190px;
    top: 14%;
    right: 18%;
    background: radial-gradient(circle at 50% 50%, #e8a030, #8a5010);
    opacity: 0.12;
    animation: bubble-drift 13s ease-in-out infinite;
    animation-delay: -7s;
  }
}

.login-card {
  position: relative;
  z-index: 1;
  width: min(calc(100vw - $spacing-8 * 2), 480px);
  padding: $spacing-6;
  border-radius: $border-radius-xl;
  border: none;
  background: rgba(18, 12, 30, 0.45);
  backdrop-filter: blur(24px) saturate(1.15);
  box-shadow: $shadow-lg;

  &__title {
    font-size: $font-size-2xl;
    color: $color-text;
    margin-bottom: $spacing-2;
    font-family: $font-family-display;
    letter-spacing: 0.04em;
  }

  &__subtitle {
    color: $color-text-muted;
    font-size: $font-size-sm;
    margin-bottom: $spacing-4;
  }

  &__form {
    display: flex;
    flex-direction: column;
    gap: $spacing-4;
  }

  &__field {
    display: flex;
    flex-direction: column;
    gap: $spacing-2;
  }

  &__label {
    font-size: $font-size-xs;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: $color-text-muted;
  }

  &__input {
    width: 100%;
    border: 1px solid rgba($border-color, 0.9);
    background: rgba($color-bg, 0.55);
    color: $color-text;
    border-radius: $border-radius-md;
    padding: $spacing-3;
    font: inherit;
    transition: border-color $transition-fast, box-shadow $transition-fast;

    &:focus {
      outline: none;
      border-color: rgba($color-primary, 0.6);
      box-shadow: 0 0 0 3px rgba($color-primary, 0.12);
    }
  }

  &__error {
    color: $color-danger;
    font-size: $font-size-sm;
  }

  &__submit {
    appearance: none;
    border: 1px solid rgba($color-primary, 0.5);
    background: rgba($color-primary, 0.18);
    color: $color-primary-light;
    border-radius: $border-radius-md;
    padding: $spacing-3 $spacing-4;
    font: inherit;
    font-weight: $font-weight-semibold;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    cursor: pointer;
    transition: background $transition-fast, box-shadow $transition-fast;

    &:hover:not(:disabled) {
      background: rgba($color-primary, 0.28);
    }

    &:disabled {
      opacity: 0.65;
      cursor: wait;
    }
  }
}
</style>
