<template>
  <div class="page login-page">
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
.login-page {
  min-height: calc(100vh - $spacing-8 * 2);
  display: grid;
  place-items: center;
}

.login-card {
  width: min(100%, 420px);
  padding: $spacing-6;
  border-radius: $border-radius-xl;
  border: 1px solid rgba($border-color, 0.82);
  background:
    linear-gradient(180deg, rgba($color-bg-card, 0.96), rgba($color-bg-elevated, 0.92));
  box-shadow: $shadow-lg;

  &__title {
    font-size: $font-size-2xl;
    color: $color-text;
    margin-bottom: $spacing-2;
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
    background: rgba($color-bg, 0.6);
    color: $color-text;
    border-radius: $border-radius-md;
    padding: $spacing-3;
    font: inherit;

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
    background: rgba($color-primary, 0.16);
    color: $color-primary-light;
    border-radius: $border-radius-full;
    padding: $spacing-3 $spacing-4;
    font: inherit;
    font-weight: $font-weight-semibold;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    cursor: pointer;

    &:disabled {
      opacity: 0.65;
      cursor: wait;
    }
  }
}
</style>
