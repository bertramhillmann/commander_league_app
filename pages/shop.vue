<template>
  <div class="page page--shop">
    <div class="shop-shell">

      <!-- ─── Storefront banner ─── -->
      <header class="shop-banner">
        <div class="shop-banner__copy">
          <p class="shop-banner__eyebrow">League Storefront</p>
          <h1 class="shop-banner__title">Looster Shop</h1>
          <p class="shop-banner__subtitle">
            Spend your hard-earned L-Points on Loosters, track every opening, and keep the card pool in sync.
          </p>
        </div>
        <div class="shop-banner__stats">
          <article class="shop-stat">
            <span class="shop-stat__label">Selected Cost</span>
            <strong class="shop-stat__value">{{ fmt(selectedShopItemCost) }} <small>L-PTS</small></strong>
          </article>
          <article class="shop-stat">
            <span class="shop-stat__label">Your Balance</span>
            <strong class="shop-stat__value" :class="{ 'shop-stat__value--low': selectedRemainingBalance < selectedShopItemCost }">
              {{ fmt(selectedRemainingBalance) }} <small>L-PTS</small>
            </strong>
          </article>
          <article class="shop-stat">
            <span class="shop-stat__label">Purchases</span>
            <strong class="shop-stat__value">{{ purchases.length }}</strong>
          </article>
        </div>
      </header>

      <!-- ─── Page-level messages ─── -->
      <p v-if="successMessage" class="form-msg form-msg--success">{{ successMessage }}</p>
      <p v-if="errorMessage && !showModal" class="form-msg form-msg--error">{{ errorMessage }}</p>

      <!-- ─── View toggle ─── -->
      <div class="shop-tabs">
        <button type="button" class="shop-tab" :class="{ 'shop-tab--active': viewMode === 'shop' }" @click="viewMode = 'shop'">
          Shop
        </button>
        <button type="button" class="shop-tab" :class="{ 'shop-tab--active': viewMode === 'history' }" @click="viewMode = 'history'">
          History
          <span v-if="purchases.length" class="shop-tab__count">{{ purchases.length }}</span>
        </button>
      </div>

      <!-- ─── Shop floor ─── -->
      <section v-if="viewMode === 'shop'" class="shop-floor">
        <header class="shop-floor__header">
          <h2 class="shop-floor__title">Available Items</h2>
          <p class="shop-floor__hint">Booster packs open the purchase dialog. Upgrades unlock instantly for your own account.</p>
        </header>

        <div class="shop-floor__grid">
          <article
            v-for="item in shopItems"
            :key="item.id"
            class="shop-item"
            role="button"
            tabindex="0"
            @click="openShopItem(item)"
            @keydown.enter="openShopItem(item)"
            @keydown.space.prevent="openShopItem(item)"
          >
            <div class="shop-item__shimmer" />

            <div class="shop-item__art">
              <div class="booster-fan" :class="{ 'booster-fan--upgrade': item.category === 'upgrade' }">
                <span class="booster-fan__card booster-fan__card--left" />
                <span class="booster-fan__card booster-fan__card--right" />
                <span class="booster-fan__card booster-fan__card--center">
                  <span class="booster-fan__glyph">✦</span>
                </span>
              </div>
            </div>

            <div class="shop-item__body">
              <div class="shop-item__type-row">
                <span class="shop-item__type">{{ item.category === 'upgrade' ? 'Commander Upgrade' : 'Booster Pack' }}</span>
                <span
                  class="shop-item__badge"
                  :class="{
                    'shop-item__badge--owned': isShopItemOwned(item),
                    'shop-item__badge--available': !isShopItemOwned(item) && !isShopItemSeasonLocked(item),
                    'shop-item__badge--locked': isShopItemSeasonLocked(item),
                  }"
                >
                  {{ getShopItemBadge(item) }}
                </span>
              </div>
              <h3 class="shop-item__name">{{ item.name }}</h3>
              <p class="shop-item__desc">
                {{ item.description }}
              </p>
            </div>

            <div class="shop-item__footer">
              <div class="shop-item__price">
                <span class="shop-item__price-glyph">◈</span>
                <span class="shop-item__price-amount">{{ fmt(item.cost) }}</span>
                <span class="shop-item__price-unit">L-Points</span>
              </div>
              <button
                type="button"
                class="shop-item__buy-btn"
                :disabled="isShopItemActionDisabled(item) || savingPurchase"
                @click.stop="openShopItem(item)"
              >
                {{ getShopItemButtonLabel(item) }}
              </button>
            </div>
          </article>
        </div>
      </section>

      <!-- ─── Purchase history ─── -->
      <section v-if="viewMode === 'history'" class="shop-history">
        <header class="shop-history__header">
          <div>
            <h2 class="shop-history__title">Purchase History</h2>
            <p class="shop-history__subtitle">Every stored purchase, newest first. Only admins can edit saved entries.</p>
          </div>
          <span class="shop-history__count">{{ purchases.length }}</span>
        </header>

        <div v-if="isAdmin" class="shop-import">
          <div class="shop-import__copy">
            <h3 class="shop-import__title">Bulk Import Purchases</h3>
            <p class="shop-import__subtitle">Upload a JSON array with `player`, `date`, `set`, `set_name`, `priceEuro`, and optional `cards` entries.</p>
          </div>
          <div class="shop-import__actions">
            <input
              ref="importFileInput"
              type="file"
              accept="application/json,.json"
              class="shop-import__input"
              @change="onImportFileChange"
            >
            <button
              type="button"
              class="btn btn--primary"
              :disabled="importingPurchases || !importFile"
              @click="importPurchasesFromFile"
            >
              {{ importingPurchases ? 'Importing...' : 'Import JSON' }}
            </button>
          </div>
          <p v-if="importFileName" class="shop-import__filename">{{ importFileName }}</p>
        </div>

        <div v-if="loadingPurchases" class="shop-empty">Loading purchases...</div>
        <div v-else-if="purchases.length === 0" class="shop-empty">No purchases saved yet.</div>
        <div v-else class="purchase-list">
          <div v-if="loadingPurchaseCardImages" class="shop-sync">
            <div class="shop-sync__meta">
              <strong>Loading {{ scryfallCardProgress.loaded }}/{{ scryfallCardProgress.total }} cards from Scryfall</strong>
              <span>{{ scryfallCardProgressLabel }}</span>
            </div>
            <div class="shop-sync__bar" aria-hidden="true">
              <span class="shop-sync__bar-fill" :style="{ width: `${scryfallCardProgressPercent}%` }" />
            </div>
          </div>
          <article v-for="purchase in purchases" :key="purchase.id" class="purchase-card">
            <template v-if="editingPurchaseId === purchase.id">
              <div class="purchase-card__edit-grid">
                <label class="form-field">
                  <span class="form-label">Player</span>
                  <input :value="editingPurchase.playerName" class="form-input" readonly />
                </label>
                <label class="form-field">
                  <span class="form-label">Date</span>
                  <input v-model="editingPurchase.date" type="date" class="form-input" required />
                </label>
                <label class="form-field">
                  <span class="form-label">Set Code</span>
                  <input v-model="editingPurchase.set" type="text" class="form-input" placeholder="e.g. DMU" required />
                </label>
                <label class="form-field">
                  <span class="form-label">Set Name</span>
                  <input v-model="editingPurchase.setName" type="text" class="form-input" placeholder="e.g. Dominaria United" required />
                </label>
                <label class="form-field">
                  <span class="form-label">Price In Euro</span>
                  <input v-model.number="editingPurchase.priceEuro" type="number" min="0" step="0.01" class="form-input" required />
                </label>
              </div>

              <label class="form-field">
                <span class="form-label">Cards</span>
                <textarea v-model="editingPurchase.cardsText" class="form-input form-textarea" />
              </label>

              <div class="purchase-card__actions">
                <button type="button" class="btn btn--primary btn--sm" :disabled="savingEdit" @click="saveEditPurchase">
                  {{ savingEdit ? 'Saving...' : 'Save Changes' }}
                </button>
                <button type="button" class="btn btn--ghost btn--sm" :disabled="savingEdit" @click="cancelEditPurchase">
                  Cancel
                </button>
              </div>
            </template>

            <template v-else>
              <div class="purchase-card__top">
                <div class="purchase-card__headline">
                  <a
                    v-if="purchaseSetImages[purchase.set]?.iconUrl"
                    class="purchase-card__set-cover"
                    :href="purchaseSetImages[purchase.set]?.scryfallUrl || undefined"
                    :target="purchaseSetImages[purchase.set]?.scryfallUrl ? '_blank' : undefined"
                    :rel="purchaseSetImages[purchase.set]?.scryfallUrl ? 'noopener noreferrer' : undefined"
                    :aria-label="`Open ${purchase.set_name} on Scryfall`"
                  >
                    <img
                      :src="purchaseSetImages[purchase.set].iconUrl"
                      :alt="`${purchase.set_name} set symbol`"
                      class="purchase-card__set-cover-image"
                      loading="lazy"
                    >
                  </a>
                  <div>
                    <p class="purchase-card__player">{{ purchase.playerName }}</p>
                    <h3 class="purchase-card__title">{{ purchase.name }}</h3>
                  </div>
                </div>
                <div class="purchase-card__meta">
                  <span>{{ purchase.date }}</span>
                  <span>{{ fmtEuro(purchase.priceEuro) }}</span>
                  <span>{{ fmt(purchase.cost) }} L-PTS</span>
                </div>
              </div>

              <div class="purchase-card__details">
                <div class="purchase-card__detail">
                  <span class="purchase-card__label">Set Code</span>
                  <a
                    class="purchase-card__value purchase-card__set-link"
                    :href="purchaseSetImages[purchase.set]?.scryfallUrl || undefined"
                    :target="purchaseSetImages[purchase.set]?.scryfallUrl ? '_blank' : undefined"
                    :rel="purchaseSetImages[purchase.set]?.scryfallUrl ? 'noopener noreferrer' : undefined"
                  >
                    {{ purchase.set }}
                  </a>
                </div>
                <div class="purchase-card__detail">
                  <span class="purchase-card__label">Set Name</span>
                  <a
                    class="purchase-card__value purchase-card__set-link"
                    :href="purchaseSetImages[purchase.set]?.scryfallUrl || undefined"
                    :target="purchaseSetImages[purchase.set]?.scryfallUrl ? '_blank' : undefined"
                    :rel="purchaseSetImages[purchase.set]?.scryfallUrl ? 'noopener noreferrer' : undefined"
                  >
                    {{ purchase.set_name }}
                  </a>
                </div>
                <div class="purchase-card__detail">
                  <span class="purchase-card__label">Type</span>
                  <span class="purchase-card__value">{{ purchase.type }}</span>
                </div>
              </div>

              <div class="purchase-card__chips">
                <a
                  v-for="card in getSortedPurchaseCards(purchase)"
                  :key="`${purchase.id}-${card}`"
                  class="purchase-card__chip"
                  :href="purchaseCardImages[getPurchaseCardLookupKey(purchase, card)]?.scryfallUrl || undefined"
                  :target="purchaseCardImages[getPurchaseCardLookupKey(purchase, card)]?.scryfallUrl ? '_blank' : undefined"
                  :rel="purchaseCardImages[getPurchaseCardLookupKey(purchase, card)]?.scryfallUrl ? 'noopener noreferrer' : undefined"
                >
                  <img
                    v-if="purchaseCardImages[getPurchaseCardLookupKey(purchase, card)]?.smallUrl"
                    :src="purchaseCardImages[getPurchaseCardLookupKey(purchase, card)].smallUrl"
                    :alt="card"
                    class="purchase-card__chip-image"
                    loading="lazy"
                  >
                  <span v-else class="purchase-card__chip-fallback">{{ card }}</span>
                  <span class="purchase-card__chip-preview">
                    <img
                      v-if="purchaseCardImages[getPurchaseCardLookupKey(purchase, card)]?.hoverUrl"
                      :src="purchaseCardImages[getPurchaseCardLookupKey(purchase, card)].hoverUrl"
                      :alt="card"
                      class="purchase-card__chip-preview-image"
                      loading="lazy"
                    >
                    <span v-else class="purchase-card__chip-preview-fallback">{{ card }}</span>
                  </span>
                </a>
              </div>

              <div v-if="isAdmin" class="purchase-card__actions">
                <button type="button" class="btn btn--muted btn--sm" @click="startEditPurchase(purchase)">
                  Edit
                </button>
                <button
                  type="button"
                  class="btn btn--ghost btn--sm"
                  :disabled="deletingPurchaseId === purchase.id"
                  @click="deletePurchase(purchase)"
                >
                  {{ deletingPurchaseId === purchase.id ? 'Deleting...' : 'Delete' }}
                </button>
              </div>
            </template>
          </article>
        </div>
      </section>

    </div>

    <!-- ─── Purchase modal ─── -->
    <Teleport to="body">
      <Transition name="shop-modal">
        <div v-if="showModal" class="modal-overlay" @click.self="closePurchaseModal">
          <div class="purchase-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">

            <button type="button" class="purchase-modal__close" aria-label="Close" @click="closePurchaseModal">✕</button>

            <div class="purchase-modal__header">
              <p class="purchase-modal__eyebrow">Register Purchase</p>
              <h2 id="modal-title" class="purchase-modal__title">Looster Pack</h2>
              <p class="purchase-modal__subtitle">
                {{ isAdmin ? 'Admins can assign purchases to any player.' : 'Purchases are saved to your own player record.' }}
              </p>
            </div>

            <form class="modal-form" @submit.prevent="submitPurchaseAndClose">

              <p v-if="errorMessage" class="form-msg form-msg--error">{{ errorMessage }}</p>

              <div class="modal-form__grid">
                <label class="form-field">
                  <span class="form-label">Player</span>
                  <select v-if="isAdmin" v-model="form.playerName" class="form-input">
                    <option v-for="name in selectablePlayers" :key="name" :value="name">{{ name }}</option>
                  </select>
                  <input v-else :value="form.playerName" class="form-input" readonly />
                </label>

                <label class="form-field">
                  <span class="form-label">Purchase Date</span>
                  <input v-model="form.date" type="date" class="form-input" required />
                </label>

                <label class="form-field">
                  <span class="form-label">Set Code</span>
                  <input v-model="form.set" type="text" class="form-input" placeholder="e.g. DMU" spellcheck="false" required />
                </label>

                <label class="form-field">
                  <span class="form-label">Set Name</span>
                  <input v-model="form.setName" type="text" class="form-input" placeholder="e.g. Dominaria United" required />
                </label>

                <label class="form-field">
                  <span class="form-label">Price In Euro</span>
                  <input v-model.number="form.priceEuro" type="number" min="0" step="0.01" class="form-input" placeholder="0.00" required />
                </label>
              </div>

              <label class="form-field">
                <span class="form-label">Cards</span>
                <textarea
                  v-model="form.cardsText"
                  class="form-input form-textarea"
                  placeholder="Enter a comma-separated card list"
                  required
                />
              </label>

              <div class="modal-balance">
                <div class="modal-balance__item">
                  <span class="modal-balance__label">Earned</span>
                  <strong class="modal-balance__value">{{ fmt(selectedEarnedBalance) }}</strong>
                </div>
                <div class="modal-balance__item">
                  <span class="modal-balance__label">Spent</span>
                  <strong class="modal-balance__value">{{ fmt(selectedSpentBalance) }}</strong>
                </div>
                <div class="modal-balance__item">
                  <span class="modal-balance__label">After Purchase</span>
                  <strong class="modal-balance__value" :class="{ 'modal-balance__value--danger': projectedRemainingBalance < 0 }">
                    {{ fmt(projectedRemainingBalance) }}
                  </strong>
                </div>
              </div>

              <p v-if="projectedRemainingBalance < 0" class="modal-warning">
                This player does not currently have enough L-Points for a Looster at the configured cost.
              </p>

              <div class="modal-form__actions">
                <button type="button" class="btn btn--ghost btn--sm" @click="closePurchaseModal">Cancel</button>
                <button type="submit" class="modal-confirm-btn" :disabled="savingPurchase || projectedRemainingBalance < 0">
                  {{ savingPurchase ? 'Processing...' : 'Confirm Purchase' }}
                </button>
              </div>

            </form>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { fetchCardsByIdentifiers, fetchSetByCode, getCardImageUrl } from '~/services/scryfallService'
import { formatPlayerName } from '~/utils/playerNames'
import type { LoosterPurchaseRecord } from '~/utils/loosterPurchases'
import type { ScryfallCard } from '~/services/scryfallService'
import { getShopItems, getStartedSeasonCount, type ShopItem } from '~/utils/shopOptions'

type PurchaseFormState = {
  playerName: string
  date: string
  set: string
  setName: string
  priceEuro: number | null
  cardsText: string
}

type PurchaseCardImage = {
  smallUrl: string
  hoverUrl: string
  scryfallUrl: string
}

type PurchaseCardSortMeta = {
  rarity: string
  colors: string[]
}

type PurchaseSetImage = {
  iconUrl: string
  scryfallUrl: string
}

type PurchaseFormAutofillState = {
  setName: string
  priceEuro: number | null
}

const today = new Date().toISOString().slice(0, 10)

const { user, isAdmin, ensureSession } = useAuth()
await ensureSession()

if (!user.value) {
  await navigateTo('/login')
}

const { init: initLeagueState, standings } = useLeagueState()
const { settings, init: initSettings } = useLeagueSettings()

await Promise.all([initLeagueState(), initSettings()])

const { data: allPlayers } = await useFetch<string[]>('/api/players')

const showModal = ref(false)
const viewMode = ref<'shop' | 'history'>('shop')
const purchases = ref<LoosterPurchaseRecord[]>([])
const purchaseCardImages = ref<Record<string, PurchaseCardImage>>({})
const purchaseCardSortMeta = ref<Record<string, PurchaseCardSortMeta>>({})
const purchaseSetImages = ref<Record<string, PurchaseSetImage>>({})
const loadingPurchases = ref(false)
const loadingPurchaseCardImages = ref(false)
const savingPurchase = ref(false)
const savingEdit = ref(false)
const importingPurchases = ref(false)
const deletingPurchaseId = ref('')
const successMessage = ref('')
const errorMessage = ref('')
const editingPurchaseId = ref('')
const importFile = ref<File | null>(null)
const importFileName = ref('')
const importFileInput = ref<HTMLInputElement | null>(null)
const formAutofill = reactive<PurchaseFormAutofillState>({
  setName: '',
  priceEuro: null,
})

const form = reactive<PurchaseFormState>({
  playerName: '',
  date: today,
  set: '',
  setName: '',
  priceEuro: null,
  cardsText: '',
})

const selectedShopItemId = ref<string>('looster')

const editingPurchase = reactive<PurchaseFormState>({
  playerName: '',
  date: today,
  set: '',
  setName: '',
  priceEuro: null,
  cardsText: '',
})

const currentPlayerName = computed(() => (user.value ? formatPlayerName(user.value) : ''))
const selectablePlayers = computed(() => {
  const merged = new Set<string>([
    ...(allPlayers.value ?? []),
    ...standings.value.map((row) => row.name),
  ])

  return Array.from(merged).sort((a, b) => a.localeCompare(b))
})

const loosterCost = computed(() => settings.value.shop.loosterCost)
const shopItems = computed(() => getShopItems(settings.value, loosterCost.value))
const selectedShopItem = computed<ShopItem | null>(() =>
  shopItems.value.find((item) => item.id === selectedShopItemId.value) ?? shopItems.value[0] ?? null,
)
const selectedShopItemCost = computed(() => selectedShopItem.value?.cost ?? loosterCost.value)
const startedSeasonCount = computed(() => getStartedSeasonCount(settings.value))
const scryfallCardProgress = reactive({
  loaded: 0,
  total: 0,
})
const scryfallCardProgressPercent = computed(() => {
  if (scryfallCardProgress.total === 0) return 0
  return Math.round((scryfallCardProgress.loaded / scryfallCardProgress.total) * 100)
})
const scryfallCardProgressLabel = computed(() => {
  if (scryfallCardProgress.total === 0) return 'Preparing Scryfall sync...'
  return `${scryfallCardProgressPercent.value}% complete`
})
let purchaseAssetsPromise: Promise<void> | null = null
let setAutofillRequestId = 0

watch(
  [currentPlayerName, selectablePlayers, isAdmin],
  () => {
    if (!isAdmin.value) {
      form.playerName = currentPlayerName.value
      return
    }

    if (!form.playerName) {
      form.playerName = currentPlayerName.value || selectablePlayers.value[0] || ''
    }
  },
  { immediate: true },
)

const spentByPlayer = computed(() => {
  const totals = new Map<string, number>()

  for (const purchase of purchases.value) {
    totals.set(purchase.playerName, round3((totals.get(purchase.playerName) ?? 0) + purchase.cost))
  }

  return totals
})

const earnedByPlayer = computed(() => {
  const totals = new Map<string, number>()

  for (const standing of standings.value) {
    totals.set(standing.name, standing.totalLPoints)
  }

  return totals
})

const selectedEarnedBalance = computed(() => earnedByPlayer.value.get(form.playerName) ?? 0)
const selectedSpentBalance = computed(() => spentByPlayer.value.get(form.playerName) ?? 0)
const selectedRemainingBalance = computed(() => round3(selectedEarnedBalance.value - selectedSpentBalance.value))
const projectedRemainingBalance = computed(() => round3(selectedRemainingBalance.value - selectedShopItemCost.value))
const ownedUpgradeTypes = computed(() => new Set(
  purchases.value
    .filter((purchase) => purchase.playerName === currentPlayerName.value)
    .map((purchase) => purchase.type),
))

watch(
  viewMode,
  (mode) => {
    if (mode === 'history') {
      void ensurePurchaseAssetsLoaded()
    }
  },
  { immediate: true },
)

watch(purchases, () => {
  if (viewMode.value === 'history') {
    void ensurePurchaseAssetsLoaded()
  }
})

watch(
  () => form.set,
  (nextSet) => {
    const normalizedSetCode = normalizeSetCode(nextSet)
    form.set = nextSet.trim().toUpperCase()
    void syncFormSetDetails(normalizedSetCode)
  },
)

onMounted(() => {
  void loadPurchases()
})

function openPurchaseModal() {
  successMessage.value = ''
  errorMessage.value = ''
  showModal.value = true
}

function isShopItemOwned(item: ShopItem) {
  if (item.purchaseType === 'looster') return false
  return ownedUpgradeTypes.value.has(item.purchaseType)
}

function isShopItemSeasonLocked(item: ShopItem) {
  return startedSeasonCount.value < item.requiredStartedSeasons
}

function canAffordShopItem(item: ShopItem) {
  return selectedRemainingBalance.value >= item.cost
}

function getShopItemBadge(item: ShopItem) {
  if (isShopItemOwned(item)) return 'Owned'
  if (isShopItemSeasonLocked(item)) return `Season ${item.requiredStartedSeasons}`
  return 'Available'
}

function getShopItemButtonLabel(item: ShopItem) {
  if (isShopItemOwned(item)) return 'Owned'
  if (item.purchaseType === 'looster') return 'Purchase'
  return 'Unlock'
}

function isShopItemActionDisabled(item: ShopItem) {
  return isShopItemOwned(item) || isShopItemSeasonLocked(item) || !canAffordShopItem(item)
}

function openShopItem(item: ShopItem) {
  selectedShopItemId.value = item.id

  if (item.purchaseType === 'looster') {
    openPurchaseModal()
    return
  }

  void purchaseUpgrade(item)
}

function closePurchaseModal() {
  showModal.value = false
}

async function submitPurchaseAndClose() {
  await submitPurchase()
  if (successMessage.value) {
    showModal.value = false
  }
}

async function purchaseUpgrade(item: ShopItem) {
  if (isShopItemActionDisabled(item) || !currentPlayerName.value) return

  const confirmed = window.confirm(`Buy ${item.name} for ${fmt(item.cost)} L-Points?`)
  if (!confirmed) return

  successMessage.value = ''
  errorMessage.value = ''
  savingPurchase.value = true

  try {
    await $fetch(`/api/players/${encodeURIComponent(currentPlayerName.value)}/purchases`, {
      method: 'POST',
      body: {
        name: item.name,
        type: item.purchaseType,
        date: today,
        set: '',
        set_name: '',
        priceEuro: 0,
        cards: [],
      },
    })

    successMessage.value = `${item.name} unlocked.`
    await loadPurchases()
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage ?? 'Failed to unlock this upgrade.'
  } finally {
    savingPurchase.value = false
  }
}

async function loadPurchases() {
  loadingPurchases.value = true

  try {
    const response = await $fetch<{ purchases: LoosterPurchaseRecord[] }>('/api/purchases')
    purchases.value = response.purchases ?? []

    if (viewMode.value === 'history') {
      void ensurePurchaseAssetsLoaded()
    }
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage ?? 'Failed to load purchases.'
  } finally {
    loadingPurchases.value = false
  }
}

async function ensurePurchaseAssetsLoaded() {
  if (purchaseAssetsPromise) return purchaseAssetsPromise

  purchaseAssetsPromise = Promise.all([
    loadPurchaseCardImages(),
    loadPurchaseSetImages(),
  ]).then(() => undefined).finally(() => {
    purchaseAssetsPromise = null
  })

  return purchaseAssetsPromise
}

async function loadPurchaseCardImages() {
  const uniqueCards = [...new Map(
    purchases.value
      .flatMap((purchase) => purchase.cards.map((card) => ({
        card,
        setCode: purchase.set,
      })))
      .filter((entry) => entry.card)
      .map((entry) => [getPurchaseCardLookupKeyByValues(entry.setCode, entry.card), entry] as const),
  ).values()]

  if (uniqueCards.length === 0) {
    loadingPurchaseCardImages.value = false
    scryfallCardProgress.loaded = 0
    scryfallCardProgress.total = 0
    return
  }

  loadingPurchaseCardImages.value = true
  scryfallCardProgress.loaded = 0
  scryfallCardProgress.total = uniqueCards.length

  try {
    const cardsByKey = await fetchCardsByIdentifiers(uniqueCards.map((entry) => ({
      name: entry.card,
      setCode: entry.setCode,
    })), {
      onProgress(loaded, total) {
        scryfallCardProgress.loaded = loaded
        scryfallCardProgress.total = total
      },
    })
    const nextImages: Record<string, PurchaseCardImage> = {
      ...purchaseCardImages.value,
    }
    const nextSortMeta: Record<string, PurchaseCardSortMeta> = {
      ...purchaseCardSortMeta.value,
    }

    for (const entry of uniqueCards) {
      const lookupKey = getPurchaseCardLookupKeyByValues(entry.setCode, entry.card)
      const card = cardsByKey.get(lookupKey)
      if (!card) continue

      const smallUrl = getCardImageUrl(card, 'small')
      const hoverUrl = getCardImageUrl(card, 'normal') ?? getCardImageUrl(card, 'large')
      if (!smallUrl && !hoverUrl) continue

      nextImages[lookupKey] = {
        smallUrl: smallUrl ?? hoverUrl ?? '',
        hoverUrl: hoverUrl ?? smallUrl ?? '',
        scryfallUrl: card.scryfall_uri ?? '',
      }

      nextSortMeta[lookupKey] = {
        rarity: card.rarity ?? '',
        colors: getCardSortColors(card),
      }
    }

    purchaseCardImages.value = nextImages
    purchaseCardSortMeta.value = nextSortMeta
  } finally {
    loadingPurchaseCardImages.value = false
  }
}

async function loadPurchaseSetImages() {
  const uniqueSetCodes = [...new Set(
    purchases.value.map((purchase) => purchase.set?.trim()).filter(Boolean),
  )] as string[]

  if (uniqueSetCodes.length === 0) {
    return
  }

  const resolvedSets = await Promise.all(uniqueSetCodes.map(async (setCode) => {
    const set = await fetchSetByCode(setCode)
    return [setCode, set] as const
  }))

  const nextImages: Record<string, PurchaseSetImage> = {
    ...purchaseSetImages.value,
  }

  for (const [setCode, set] of resolvedSets) {
    if (!set?.icon_svg_uri || !set?.scryfall_uri) continue

    nextImages[setCode] = {
      iconUrl: set.icon_svg_uri,
      scryfallUrl: set.scryfall_uri,
    }
  }

  purchaseSetImages.value = nextImages
}

function getSortedPurchaseCards(purchase: LoosterPurchaseRecord) {
  return [...purchase.cards].sort((left, right) => comparePurchaseCards(left, right, purchase))
}

function comparePurchaseCards(left: string, right: string, purchase?: LoosterPurchaseRecord) {
  const leftMeta = purchaseCardSortMeta.value[getPurchaseCardLookupKey(purchase, left)]
  const rightMeta = purchaseCardSortMeta.value[getPurchaseCardLookupKey(purchase, right)]

  const rarityDiff = getRarityRank(leftMeta?.rarity) - getRarityRank(rightMeta?.rarity)
  if (rarityDiff !== 0) return rarityDiff

  const colorDiff = compareColorOrder(leftMeta?.colors ?? [], rightMeta?.colors ?? [])
  if (colorDiff !== 0) return colorDiff

  return left.localeCompare(right)
}

function getRarityRank(rarity?: string) {
  switch (rarity) {
    case 'mythic':
      return 0
    case 'rare':
      return 1
    case 'uncommon':
      return 2
    case 'common':
      return 3
    case 'special':
      return 4
    case 'bonus':
      return 5
    default:
      return 6
  }
}

function getCardSortColors(card: ScryfallCard) {
  return [...(card.colors?.length ? card.colors : card.color_identity ?? [])]
}

function compareColorOrder(left: string[], right: string[]) {
  const leftClass = getColorClassRank(left)
  const rightClass = getColorClassRank(right)

  if (leftClass !== rightClass) return leftClass - rightClass

  const colorCountDiff = left.length - right.length
  if (colorCountDiff !== 0) return colorCountDiff

  const maxLength = Math.max(left.length, right.length)
  for (let index = 0; index < maxLength; index += 1) {
    const leftRank = getSingleColorRank(left[index])
    const rightRank = getSingleColorRank(right[index])

    if (leftRank !== rightRank) return leftRank - rightRank
  }

  return 0
}

function getColorClassRank(colors: string[]) {
  if (colors.length === 1) return 0
  if (colors.length > 1) return 1
  return 2
}

function getSingleColorRank(color?: string) {
  switch (color) {
    case 'W':
      return 0
    case 'U':
      return 1
    case 'B':
      return 2
    case 'R':
      return 3
    case 'G':
      return 4
    default:
      return 5
  }
}

async function submitPurchase() {
  successMessage.value = ''
  errorMessage.value = ''

  if (!form.playerName) {
    errorMessage.value = 'A player is required.'
    return
  }

  savingPurchase.value = true

  try {
    await $fetch(`/api/players/${encodeURIComponent(form.playerName)}/purchases`, {
      method: 'POST',
      body: {
        name: 'Looster',
        type: 'looster',
        date: form.date,
        set: form.set,
        set_name: form.setName,
        priceEuro: form.priceEuro,
        cards: form.cardsText,
      },
    })

    successMessage.value = 'Purchase saved.'
    resetPurchaseFormSetFields()
    form.cardsText = ''
    form.date = today
    await loadPurchases()
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage ?? 'Failed to save purchase.'
  } finally {
    savingPurchase.value = false
  }
}

function startEditPurchase(purchase: LoosterPurchaseRecord) {
  editingPurchaseId.value = purchase.id
  editingPurchase.playerName = purchase.playerName
  editingPurchase.date = purchase.date
  editingPurchase.set = purchase.set
  editingPurchase.setName = purchase.set_name
  editingPurchase.priceEuro = purchase.priceEuro
  editingPurchase.cardsText = purchase.cards.join(', ')
}

function cancelEditPurchase() {
  editingPurchaseId.value = ''
  editingPurchase.playerName = ''
  editingPurchase.date = today
  editingPurchase.set = ''
  editingPurchase.setName = ''
  editingPurchase.priceEuro = null
  editingPurchase.cardsText = ''
}

async function saveEditPurchase() {
  if (!editingPurchaseId.value) return

  successMessage.value = ''
  errorMessage.value = ''
  savingEdit.value = true

  try {
    await $fetch(`/api/players/${encodeURIComponent(editingPurchase.playerName)}/purchases/${encodeURIComponent(editingPurchaseId.value)}`, {
      method: 'PUT',
      body: {
        name: 'Looster',
        type: 'looster',
        date: editingPurchase.date,
        set: editingPurchase.set,
        set_name: editingPurchase.setName,
        priceEuro: editingPurchase.priceEuro,
        cards: editingPurchase.cardsText,
      },
    })

    successMessage.value = 'Purchase updated.'
    cancelEditPurchase()
    await loadPurchases()
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage ?? 'Failed to update purchase.'
  } finally {
    savingEdit.value = false
  }
}

async function deletePurchase(purchase: LoosterPurchaseRecord) {
  const confirmed = window.confirm(`Delete purchase for ${purchase.playerName} from ${purchase.date}?`)
  if (!confirmed) return

  successMessage.value = ''
  errorMessage.value = ''
  deletingPurchaseId.value = purchase.id

  try {
    await $fetch(`/api/players/${encodeURIComponent(purchase.playerName)}/purchases/${encodeURIComponent(purchase.id)}`, {
      method: 'DELETE',
    })

    if (editingPurchaseId.value === purchase.id) {
      cancelEditPurchase()
    }

    successMessage.value = 'Purchase deleted.'
    await loadPurchases()
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage ?? 'Failed to delete purchase.'
  } finally {
    deletingPurchaseId.value = ''
  }
}

function onImportFileChange(event: Event) {
  const input = event.target as HTMLInputElement | null
  const file = input?.files?.[0] ?? null
  importFile.value = file
  importFileName.value = file?.name ?? ''
}

async function importPurchasesFromFile() {
  if (!importFile.value) return

  successMessage.value = ''
  errorMessage.value = ''
  importingPurchases.value = true

  try {
    const raw = await importFile.value.text()
    const parsed = JSON.parse(raw)
    const entries = Array.isArray(parsed) ? parsed : parsed?.entries

    if (!Array.isArray(entries)) {
      throw new Error('The JSON file must contain an array of purchase entries.')
    }

    const normalizedEntries = entries.map((entry: any) => ({
      player: entry?.player,
      date: entry?.date,
      set: entry?.set,
      set_name: entry?.set_name,
      priceEuro: entry?.priceEuro,
      cards: Array.isArray(entry?.cards) ? entry.cards : [],
      name: entry?.name,
      type: entry?.type,
    }))

    const response = await $fetch<{ importedCount: number }>('/api/purchases/import', {
      method: 'POST',
      body: {
        entries: normalizedEntries,
      },
    })

    successMessage.value = `Imported ${response.importedCount} purchase${response.importedCount === 1 ? '' : 's'}.`
    importFile.value = null
    importFileName.value = ''
    if (importFileInput.value) importFileInput.value.value = ''
    await loadPurchases()
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage
      ?? error?.message
      ?? 'Failed to import purchases.'
  } finally {
    importingPurchases.value = false
  }
}

function fmt(value: number) {
  if (value === 0) return '0'
  return value % 1 === 0 ? String(value) : value.toFixed(3).replace(/\.?0+$/, '')
}

function fmtEuro(value: number) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(value)
}

function round3(value: number) {
  return Math.round(value * 1000) / 1000
}

function normalizeSetCode(value: string) {
  return value.trim().toLowerCase()
}

function getPurchaseCardLookupKeyByValues(setCode: string, cardName: string) {
  return `${normalizeSetCode(setCode)}::${cardName.trim().toLowerCase()}`
}

function getPurchaseCardLookupKey(purchase: LoosterPurchaseRecord | undefined, cardName: string) {
  return getPurchaseCardLookupKeyByValues(purchase?.set ?? '', cardName)
}

function getMostRecentPriceForSet(setCode: string) {
  const normalizedSetCode = normalizeSetCode(setCode)
  const match = purchases.value.find((purchase) => normalizeSetCode(purchase.set) === normalizedSetCode)
  return match?.priceEuro ?? null
}

function resetPurchaseFormSetFields() {
  form.set = ''
  form.setName = ''
  form.priceEuro = null
  formAutofill.setName = ''
  formAutofill.priceEuro = null
}

async function syncFormSetDetails(setCode: string) {
  const requestId = ++setAutofillRequestId

  if (!setCode) {
    if (form.setName === formAutofill.setName) form.setName = ''
    if (form.priceEuro === formAutofill.priceEuro) form.priceEuro = null
    formAutofill.setName = ''
    formAutofill.priceEuro = null
    return
  }

  const recentPrice = getMostRecentPriceForSet(setCode)
  if (form.priceEuro == null || form.priceEuro === formAutofill.priceEuro) {
    form.priceEuro = recentPrice
    formAutofill.priceEuro = recentPrice
  }

  const set = await fetchSetByCode(setCode)
  if (requestId !== setAutofillRequestId) return

  const nextSetName = set?.name ?? ''
  if (!form.setName || form.setName === formAutofill.setName) {
    form.setName = nextSetName
    formAutofill.setName = nextSetName
  }
}
</script>

<style lang="scss" scoped>
// ── Layout shell ──────────────────────────────────────────────────────────────

.shop-shell {
  width: min(1100px, 100%);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: $spacing-8;
}

// ── Storefront banner ─────────────────────────────────────────────────────────

.shop-banner {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(280px, 1fr);
  gap: $spacing-6;
  padding: $spacing-6;
  border-radius: $border-radius-xl;
  border: 1px solid rgba($color-primary-light, 0.18);
  background:
    radial-gradient(ellipse at 25% 60%, rgba($color-primary, 0.18) 0%, transparent 50%),
    radial-gradient(ellipse at 75% 20%, rgba($color-accent, 0.05) 0%, transparent 45%),
    linear-gradient(135deg, rgba(15, 8, 30, 0.96), rgba(8, 4, 18, 0.98));
  backdrop-filter: blur(3px);
  box-shadow:
    inset 0 0 0 1px rgba(255, 240, 214, 0.03),
    $shadow-lg;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(90deg,
      transparent 0%,
      rgba($color-accent, 0.55) 25%,
      rgba($color-primary-light, 0.55) 75%,
      transparent 100%
    );
  }

  &__copy {
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  &__eyebrow {
    margin: 0 0 $spacing-2;
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: rgba($color-accent, 0.85);
    font-weight: $font-weight-semibold;
  }

  &__title {
    margin: 0;
    font-size: clamp(2.2rem, 5vw, 3.4rem);
    color: $color-text;
    line-height: 1.1;
    text-shadow: 0 0 40px rgba($color-primary-light, 0.2);
  }

  &__subtitle {
    margin: $spacing-3 0 0;
    max-width: 38rem;
    color: $color-text-muted;
    line-height: 1.7;
    font-size: $font-size-sm;
  }

  &__stats {
    display: flex;
    flex-direction: column;
    gap: $spacing-3;
    justify-content: center;
  }
}

// ── Stat cards ────────────────────────────────────────────────────────────────

.shop-stat {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $spacing-3;
  padding: $spacing-3 $spacing-4;
  border-radius: $border-radius-lg;
  background:
    linear-gradient(180deg, rgba($color-primary, 0.08), rgba(255, 255, 255, 0.01)),
    rgba(7, 10, 16, 0.72);
  border: 1px solid rgba($color-primary-light, 0.16);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.02);

  &__label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-weight: $font-weight-semibold;
    color: rgba($color-primary-light, 0.75);
  }

  &__value {
    font-size: $font-size-lg;
    font-weight: $font-weight-bold;
    color: $color-text;
    text-align: right;

    small {
      font-size: 9px;
      font-weight: $font-weight-semibold;
      letter-spacing: 0.08em;
      color: $color-text-muted;
      margin-left: 3px;
    }

    &--low {
      color: $color-danger;
    }
  }
}

// ── View toggle ───────────────────────────────────────────────────────────────

.shop-tabs {
  display: inline-flex;
  gap: $spacing-1;
  padding: $spacing-1;
  width: fit-content;
  border-radius: $border-radius-full;
  background: rgba($color-bg, 0.6);
  border: 1px solid rgba($color-primary-light, 0.14);
}

.shop-tab {
  appearance: none;
  display: inline-flex;
  align-items: center;
  gap: $spacing-2;
  border: 1px solid transparent;
  border-radius: $border-radius-full;
  padding: $spacing-2 $spacing-4;
  background: transparent;
  color: $color-text-muted;
  font: inherit;
  font-size: $font-size-sm;
  font-weight: $font-weight-semibold;
  cursor: pointer;
  transition: background $transition-fast, color $transition-fast, border-color $transition-fast;

  &:hover {
    color: $color-text;
    background: rgba($color-primary-light, 0.08);
  }

  &--active {
    background: rgba($color-primary, 0.72);
    border-color: rgba($color-primary-light, 0.35);
    color: $color-text;
  }

  &__count {
    display: inline-grid;
    place-items: center;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: $border-radius-full;
    background: rgba($color-primary-light, 0.2);
    color: $color-primary-light;
    font-size: 10px;
    font-weight: $font-weight-bold;
    line-height: 1;
  }

  &--active &__count {
    background: rgba(255, 255, 255, 0.15);
    color: $color-text;
  }
}

// ── Shop floor ────────────────────────────────────────────────────────────────

.shop-floor {
  &__header {
    display: flex;
    align-items: baseline;
    gap: $spacing-3;
    margin-bottom: $spacing-6;
    padding-bottom: $spacing-3;
    border-bottom: 1px solid rgba($color-primary-light, 0.1);
  }

  &__title {
    margin: 0;
    font-size: $font-size-xl;
    color: $color-text;
    letter-spacing: 0.04em;
  }

  &__hint {
    margin: 0;
    font-size: $font-size-xs;
    color: $color-text-muted;
    letter-spacing: 0.04em;
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 300px));
    gap: $spacing-6;
    justify-content: start;
  }
}

// ── Shop item card ────────────────────────────────────────────────────────────

.shop-item {
  position: relative;
  display: flex;
  flex-direction: column;
  border-radius: $border-radius-xl;
  border: 1px solid rgba($color-primary-light, 0.28);
  background: linear-gradient(180deg, rgba(22, 10, 45, 0.97), rgba(9, 5, 20, 0.99));
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.03),
    0 12px 40px rgba(0, 0, 0, 0.55);
  cursor: pointer;
  overflow: hidden;
  transition: transform $transition-base, border-color $transition-base, box-shadow $transition-base;
  user-select: none;

  &:hover:not(.shop-item--locked) {
    transform: translateY(-8px);
    border-color: rgba($color-accent, 0.55);
    box-shadow:
      inset 0 0 0 1px rgba($color-accent, 0.05),
      0 0 32px rgba($color-accent, 0.08),
      0 24px 56px rgba(0, 0, 0, 0.65);

    .shop-item__shimmer { opacity: 1; }
    .shop-item__art { background-position: 50% 40%; }
    .booster-fan__card--center {
      box-shadow:
        0 0 28px rgba($color-accent, 0.25),
        0 8px 24px rgba(0, 0, 0, 0.6);
    }
  }

  &--locked {
    cursor: not-allowed;
    filter: saturate(0.45) brightness(0.7);
  }

  &:focus-visible {
    outline: 2px solid rgba($color-accent, 0.65);
    outline-offset: 3px;
  }
}

.shop-item__shimmer {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, transparent 50%);
  pointer-events: none;
  opacity: 0;
  transition: opacity $transition-base;
  z-index: 1;
}

.shop-item__art {
  position: relative;
  height: 190px;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(ellipse at 50% 75%, rgba($color-primary, 0.35) 0%, transparent 60%),
    radial-gradient(ellipse at 50% 20%, rgba($color-primary-dark, 0.2) 0%, transparent 55%),
    linear-gradient(180deg, rgba(10, 5, 22, 0.9), rgba(18, 8, 40, 0.95));
  border-bottom: 1px solid rgba($color-primary-light, 0.12);
  overflow: hidden;
  transition: background-position $transition-slow;
}

// ── CSS booster fan art ───────────────────────────────────────────────────────

.booster-fan {
  position: relative;
  width: 200px;
  height: 130px;

  &__card {
    position: absolute;
    width: 74px;
    height: 104px;
    border-radius: 7px;
    bottom: 0;
    transform-origin: bottom center;

    &--left {
      left: 6px;
      transform: rotate(-22deg);
      background: linear-gradient(160deg, rgba(38, 18, 72, 0.97), rgba(12, 6, 28, 0.99));
      border: 1px solid rgba($color-primary, 0.45);
      box-shadow: -3px 6px 16px rgba(0, 0, 0, 0.5);
      z-index: 1;
    }

    &--right {
      right: 6px;
      transform: rotate(22deg);
      background: linear-gradient(160deg, rgba(48, 22, 88, 0.97), rgba(16, 8, 36, 0.99));
      border: 1px solid rgba($color-primary-light, 0.38);
      box-shadow: 3px 6px 16px rgba(0, 0, 0, 0.5);
      z-index: 2;
    }

    &--center {
      left: 63px;
      transform: translateY(-8px);
      background: linear-gradient(160deg,
        rgba(88, 44, 175, 0.97) 0%,
        rgba(48, 22, 100, 0.99) 100%
      );
      border: 1px solid rgba($color-accent, 0.6);
      box-shadow:
        0 0 22px rgba($color-accent, 0.15),
        0 8px 22px rgba(0, 0, 0, 0.55);
      z-index: 3;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: box-shadow $transition-base;
    }
  }

  &__glyph {
    font-size: 1.6rem;
    color: rgba($color-accent, 0.75);
    text-shadow: 0 0 16px rgba($color-accent, 0.5);
  }
}

// ── Item body & footer ────────────────────────────────────────────────────────

.shop-item__body {
  padding: $spacing-4;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
}

.shop-item__type-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $spacing-2;
}

.shop-item__type {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-weight: $font-weight-semibold;
  color: rgba($color-primary-light, 0.75);
}

.shop-item__badge {
  font-size: 9px;
  font-weight: $font-weight-bold;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 2px 7px;
  border-radius: $border-radius-full;

  &--available {
    background: rgba($color-secondary, 0.14);
    border: 1px solid rgba($color-secondary, 0.3);
    color: $color-secondary;
  }

  &--locked {
    background: rgba($color-danger, 0.1);
    border: 1px solid rgba($color-danger, 0.25);
    color: rgba($color-danger, 0.8);
  }
}

.shop-item__name {
  margin: 0;
  font-family: $font-family-display;
  font-size: $font-size-2xl;
  color: $color-text;
  line-height: 1.1;
}

.shop-item__desc {
  margin: 0;
  font-size: $font-size-xs;
  color: $color-text-muted;
  line-height: 1.6;
}

.shop-item__footer {
  padding: $spacing-3 $spacing-4;
  border-top: 1px solid rgba($color-primary-light, 0.1);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $spacing-3;
  background: rgba(0, 0, 0, 0.2);
}

.shop-item__price {
  display: flex;
  align-items: baseline;
  gap: 4px;

  &-glyph {
    font-size: $font-size-base;
    color: $color-accent;
  }

  &-amount {
    font-size: $font-size-xl;
    font-weight: $font-weight-bold;
    color: $color-accent;
    line-height: 1;
  }

  &-unit {
    font-size: 9px;
    font-weight: $font-weight-semibold;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba($color-accent, 0.6);
  }
}

.shop-item__buy-btn {
  appearance: none;
  padding: 7px 16px;
  border-radius: $border-radius-md;
  background: linear-gradient(135deg, rgba($color-accent, 0.85), rgba(180, 100, 8, 0.9));
  border: 1px solid rgba($color-accent, 0.5);
  color: #1a0e00;
  font: inherit;
  font-size: $font-size-xs;
  font-weight: $font-weight-bold;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  cursor: pointer;
  white-space: nowrap;
  transition: all $transition-fast;

  &:hover:not(:disabled) {
    background: linear-gradient(135deg, $color-accent, #c07008);
    box-shadow: 0 0 14px rgba($color-accent, 0.3);
    transform: translateY(-1px);
  }

  &:disabled {
    background: rgba($color-danger, 0.15);
    border-color: rgba($color-danger, 0.25);
    color: rgba($color-danger, 0.7);
    cursor: not-allowed;
    transform: none;
  }
}

// ── Purchase history ──────────────────────────────────────────────────────────

.shop-history {
  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $spacing-4;
    margin-bottom: $spacing-4;
    padding-bottom: $spacing-3;
    border-bottom: 1px solid rgba($color-primary-light, 0.1);
  }

  &__title {
    margin: 0;
    font-size: $font-size-xl;
    color: $color-text;
    letter-spacing: 0.04em;
  }

  &__subtitle {
    margin: $spacing-1 0 0;
    color: $color-text-muted;
    font-size: $font-size-sm;
  }

  &__count {
    flex-shrink: 0;
    min-width: 28px;
    height: 28px;
    display: grid;
    place-items: center;
    border-radius: $border-radius-full;
    background: rgba($color-primary, 0.2);
    border: 1px solid rgba($color-primary-light, 0.25);
    color: $color-primary-light;
    font-size: $font-size-xs;
    font-weight: $font-weight-bold;
    padding: 0 $spacing-2;
  }
}

.shop-empty {
  padding: $spacing-6 $spacing-4;
  border-radius: $border-radius-lg;
  color: $color-text-muted;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.01));
  border: 1px solid rgba($color-primary-light, 0.1);
  text-align: center;
  font-size: $font-size-sm;
}

.shop-sync {
  margin-bottom: $spacing-4;
  padding: $spacing-4;
  border-radius: $border-radius-lg;
  border: 1px solid rgba($color-primary-light, 0.18);
  background:
    radial-gradient(circle at top right, rgba($color-primary, 0.18), transparent 45%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.01));

  &__meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $spacing-3;
    margin-bottom: $spacing-3;
    font-size: $font-size-sm;
    color: $color-text-muted;

    strong {
      color: $color-text;
      font-weight: $font-weight-semibold;
    }
  }

  &__bar {
    overflow: hidden;
    height: 10px;
    border-radius: $border-radius-full;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba($color-primary-light, 0.12);
  }

  &__bar-fill {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, rgba($color-primary, 0.75), rgba($color-primary-light, 0.95));
    transition: width 0.2s ease;
  }
}

.shop-import {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: $spacing-3;
  margin-bottom: $spacing-4;
  padding: $spacing-4;
  border-radius: $border-radius-lg;
  border: 1px solid rgba($color-primary-light, 0.14);
  background:
    linear-gradient(180deg, rgba($color-primary, 0.06), rgba(255, 255, 255, 0.02)),
    rgba(7, 10, 16, 0.68);

  &__copy {
    flex: 1 1 280px;
  }

  &__title {
    margin: 0 0 $spacing-1;
    color: $color-text;
    font-size: $font-size-base;
    font-weight: $font-weight-semibold;
  }

  &__subtitle {
    margin: 0;
    color: $color-text-muted;
    font-size: $font-size-sm;
  }

  &__actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: $spacing-2;
  }

  &__input {
    color: $color-text-muted;
    font-size: $font-size-xs;

    &::file-selector-button {
      appearance: none;
      padding: 4px 12px;
      border-radius: $border-radius-md;
      background: rgba($color-bg-elevated, 0.7);
      border: 1px solid rgba($border-color, 0.7);
      color: $color-text-muted;
      font: inherit;
      font-size: $font-size-xs;
      font-weight: $font-weight-semibold;
      cursor: pointer;
      margin-right: $spacing-2;
      transition: background $transition-fast, color $transition-fast, border-color $transition-fast;
    }

    &:hover::file-selector-button {
      color: $color-text;
      border-color: rgba($color-primary-light, 0.35);
      background: rgba($color-bg-elevated, 1);
    }
  }

  &__filename {
    width: 100%;
    margin: 0;
    color: rgba($color-primary-light, 0.82);
    font-size: $font-size-xs;
  }
}

// ── Purchase cards ────────────────────────────────────────────────────────────

.purchase-list {
  display: flex;
  flex-direction: column;
  gap: $spacing-3;
}

.purchase-card {
  padding: $spacing-4;
  border-radius: $border-radius-lg;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02)),
    rgba(7, 10, 16, 0.72);
  border: 1px solid rgba($color-primary-light, 0.16);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.02),
    0 8px 24px rgba(0, 0, 0, 0.18);
  transition: border-color $transition-fast, transform $transition-fast, background $transition-fast, box-shadow $transition-fast;

  &:hover {
    transform: translateY(-2px);
    border-color: rgba($color-primary-light, 0.34);
    background:
      linear-gradient(180deg, rgba($color-primary, 0.08), rgba(255, 255, 255, 0.03)),
      rgba(7, 10, 16, 0.78);
    box-shadow:
      inset 0 0 0 1px rgba(255, 255, 255, 0.03),
      0 12px 28px rgba(0, 0, 0, 0.24);
  }

  &__top {
    display: flex;
    justify-content: space-between;
    gap: $spacing-4;
    margin-bottom: $spacing-3;
  }

  &__headline {
    display: flex;
    align-items: center;
    gap: $spacing-3;
    min-width: 0;
  }

  &__set-cover {
    flex-shrink: 0;
    width: 48px;
    height: 48px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: $border-radius-md;
    background: radial-gradient(circle at 50% 50%, rgba($color-primary, 0.12), rgba($color-bg-elevated, 0.95));
    border: 1px solid rgba($color-primary-light, 0.18);
    box-shadow: 0 8px 18px rgba(0, 0, 0, 0.2);
    text-decoration: none;
    transition: transform $transition-fast, border-color $transition-fast, background $transition-fast;

    &:hover {
      transform: translateY(-1px) scale(1.02);
      border-color: rgba($color-primary-light, 0.34);
      background: radial-gradient(circle at 50% 50%, rgba($color-primary, 0.2), rgba($color-bg-elevated, 0.98));
    }
  }

  &__set-cover-image {
    width: 30px;
    height: 30px;
    display: block;
    object-fit: contain;
    filter: brightness(0) invert(1) drop-shadow(0 6px 10px rgba(0, 0, 0, 0.35));
  }

  &__player {
    margin: 0 0 $spacing-1;
    color: rgba($color-primary-light, 0.88);
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    font-weight: $font-weight-semibold;
  }

  &__title {
    margin: 0;
    color: $color-text;
    font-size: $font-size-lg;
    font-weight: $font-weight-semibold;
  }

  &__meta {
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-2;
    justify-content: flex-end;
    align-items: flex-start;

    span {
      font-size: 10px;
      color: rgba($color-text, 0.86);
      background: rgba($color-primary, 0.08);
      border: 1px solid rgba($color-primary-light, 0.14);
      border-radius: $border-radius-full;
      padding: 2px 8px;
      white-space: nowrap;
    }
  }

  &__details {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: $spacing-3;
    margin-bottom: $spacing-3;
  }

  &__detail {
    display: flex;
    flex-direction: column;
    gap: $spacing-1;
  }

  &__label {
    color: $color-text-muted;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: $font-weight-semibold;
  }

  &__value {
    color: $color-text;
    font-size: $font-size-sm;
  }

  &__set-link {
    display: inline-flex;
    align-items: center;
    gap: $spacing-1;
    width: fit-content;
    color: rgba($color-primary-light, 0.96);
    text-decoration: none;
    transition: color $transition-fast, text-decoration-color $transition-fast;

    &:hover {
      color: $color-text;
      text-decoration: underline;
      text-decoration-color: rgba($color-primary-light, 0.42);
    }
  }

  &__chips {
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-2;
  }

  &__chip {
    position: relative;
    display: inline-flex;
    width: 52px;
    height: 72px;
    border-radius: $border-radius-md;
    overflow: visible;
    text-decoration: none;
    transition: transform $transition-fast;

    &:hover {
      transform: translateY(-2px);
      z-index: 3;
    }

    &:hover .purchase-card__chip-preview {
      opacity: 1;
      transform: translate(-50%, calc(-100% - 10px)) scale(1);
      pointer-events: auto;
    }
  }

  &__chip-image {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
    border-radius: $border-radius-md;
    border: 1px solid rgba($color-primary-light, 0.18);
    box-shadow: 0 8px 18px rgba(0, 0, 0, 0.28);
    background: rgba($color-bg-elevated, 0.9);
  }

  &__chip-fallback {
    width: 100%;
    height: 100%;
    padding: $spacing-1;
    display: grid;
    place-items: center;
    text-align: center;
    border-radius: $border-radius-md;
    background: rgba($color-secondary, 0.12);
    border: 1px solid rgba($color-secondary, 0.2);
    color: $color-text;
    font-size: 9px;
    line-height: 1.25;
  }

  &__chip-preview {
    position: absolute;
    left: 50%;
    top: 0;
    width: 220px;
    opacity: 0;
    pointer-events: none;
    transform: translate(-50%, calc(-100% - 4px)) scale(0.96);
    transform-origin: bottom center;
    transition: opacity $transition-fast, transform $transition-fast;
  }

  &__chip-preview-image {
    width: 100%;
    display: block;
    border-radius: $border-radius-lg;
    border: 1px solid rgba($color-primary-light, 0.28);
    box-shadow: 0 18px 40px rgba(0, 0, 0, 0.42);
    background: rgba($color-bg-elevated, 0.96);
  }

  &__chip-preview-fallback {
    display: block;
    padding: $spacing-3;
    text-align: center;
    border-radius: $border-radius-lg;
    background: rgba($color-bg-elevated, 0.96);
    border: 1px solid rgba($color-primary-light, 0.18);
    color: $color-text;
    font-size: $font-size-sm;
    line-height: 1.4;
    box-shadow: 0 18px 40px rgba(0, 0, 0, 0.42);
  }

  &__actions {
    display: flex;
    justify-content: flex-end;
    gap: $spacing-2;
    margin-top: $spacing-3;
  }

  &__edit-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: $spacing-4;
    margin-bottom: $spacing-3;
  }
}

// ── Modal overlay ─────────────────────────────────────────────────────────────

.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0, 0, 0, 0.78);
  backdrop-filter: blur(8px);
  display: grid;
  place-items: center;
  padding: $spacing-4;
}

// ── Purchase modal dialog ─────────────────────────────────────────────────────

.purchase-modal {
  position: relative;
  width: min(560px, 100%);
  max-height: 90vh;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba($color-primary-light, 0.2) transparent;
  border-radius: $border-radius-xl;
  border: 1px solid rgba($color-primary-light, 0.32);
  background:
    radial-gradient(ellipse at 50% 0%, rgba($color-primary, 0.14) 0%, transparent 55%),
    linear-gradient(180deg, rgba(20, 10, 42, 0.98), rgba(8, 4, 18, 0.99));
  box-shadow:
    0 0 0 1px rgba($color-accent, 0.05),
    inset 0 0 60px rgba($color-primary, 0.05),
    0 32px 80px rgba(0, 0, 0, 0.75);
  padding: $spacing-6;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(90deg,
      transparent 0%,
      rgba($color-accent, 0.6) 30%,
      rgba($color-primary-light, 0.6) 70%,
      transparent 100%
    );
  }

  &__close {
    position: absolute;
    top: $spacing-4;
    right: $spacing-4;
    appearance: none;
    width: 28px;
    height: 28px;
    display: grid;
    place-items: center;
    border-radius: $border-radius-full;
    background: rgba($color-primary-light, 0.1);
    border: 1px solid rgba($color-primary-light, 0.2);
    color: $color-text-muted;
    font-size: $font-size-xs;
    cursor: pointer;
    transition: background $transition-fast, color $transition-fast;
    z-index: 1;

    &:hover {
      background: rgba($color-primary-light, 0.2);
      color: $color-text;
    }
  }

  &__header {
    margin-bottom: $spacing-6;
    padding-bottom: $spacing-4;
    border-bottom: 1px solid rgba($color-primary-light, 0.1);
  }

  &__eyebrow {
    margin: 0 0 $spacing-2;
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: rgba($color-accent, 0.85);
    font-weight: $font-weight-semibold;
  }

  &__title {
    margin: 0 0 $spacing-2;
    font-size: $font-size-2xl;
    color: $color-text;
  }

  &__subtitle {
    margin: 0;
    color: $color-text-muted;
    font-size: $font-size-sm;
  }
}

// ── Modal form ────────────────────────────────────────────────────────────────

.modal-form {
  display: flex;
  flex-direction: column;
  gap: $spacing-4;

  &__grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: $spacing-4;
  }

  &__actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: $spacing-3;
    padding-top: $spacing-2;
  }
}

.form-textarea {
  min-height: 7rem;
  resize: vertical;
}

// ── Modal balance summary ─────────────────────────────────────────────────────

.modal-balance {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: $spacing-2;

  &__item {
    padding: $spacing-2 $spacing-3;
    border-radius: $border-radius-md;
    background: rgba($color-bg-elevated, 0.45);
    border: 1px solid rgba($border-color, 0.5);
    text-align: center;
  }

  &__label {
    display: block;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-weight: $font-weight-semibold;
    color: $color-text-muted;
    margin-bottom: 4px;
  }

  &__value {
    font-size: $font-size-base;
    font-weight: $font-weight-bold;
    color: $color-text;

    &--danger {
      color: $color-danger;
    }
  }
}

.modal-warning {
  padding: $spacing-3;
  border-radius: $border-radius-md;
  border: 1px solid rgba($color-danger, 0.25);
  background: rgba($color-danger, 0.08);
  color: rgba($color-danger, 0.96);
  font-size: $font-size-sm;
}

// ── Modal confirm button (gold RPG style) ─────────────────────────────────────

.modal-confirm-btn {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 11px 28px;
  border-radius: $border-radius-md;
  background: linear-gradient(135deg, rgba($color-accent, 0.92), rgba(178, 98, 8, 0.96));
  border: 1px solid rgba($color-accent, 0.55);
  color: #1a0e00;
  font: inherit;
  font-size: $font-size-sm;
  font-weight: $font-weight-bold;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all $transition-fast;

  &:hover:not(:disabled) {
    background: linear-gradient(135deg, $color-accent, #c07008);
    box-shadow: 0 0 22px rgba($color-accent, 0.32), 0 4px 12px rgba(0, 0, 0, 0.35);
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
    transform: none;
  }
}

// ── Modal transition ──────────────────────────────────────────────────────────

.shop-modal-enter-active,
.shop-modal-leave-active {
  transition: opacity 0.25s ease;
}

.shop-modal-enter-from,
.shop-modal-leave-to {
  opacity: 0;
}

// ── Form elements (local) ─────────────────────────────────────────────────────

.form-field {
  display: flex;
  flex-direction: column;
  gap: $spacing-1;
}

.form-label {
  font-size: $font-size-xs;
  font-weight: $font-weight-semibold;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: $color-text-muted;
}

.form-input {
  appearance: none;
  width: 100%;
  padding: 7px 9px;
  border: 1px solid rgba($border-color, 0.75);
  border-radius: $border-radius-md;
  background: rgba($color-bg-elevated, 0.6);
  color: $color-text;
  font: inherit;
  font-size: $font-size-sm;
  transition: border-color $transition-fast, background $transition-fast;

  &:focus {
    outline: none;
    border-color: rgba($color-accent, 0.55);
    background: rgba($color-bg-elevated, 0.9);
  }

  &[readonly] {
    opacity: 0.6;
    cursor: default;
  }
}

select.form-input { cursor: pointer; }
textarea.form-input { resize: vertical; }

.btn {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 9px 18px;
  border-radius: $border-radius-md;
  font: inherit;
  font-size: $font-size-sm;
  font-weight: $font-weight-semibold;
  cursor: pointer;
  transition: background $transition-fast, border-color $transition-fast, color $transition-fast;

  &--primary {
    background: $color-primary;
    border: 1px solid rgba($color-primary-light, 0.5);
    color: $color-text;
    &:hover:not(:disabled) { background: $color-primary-light; }
  }

  &--muted {
    background: transparent;
    border: 1px solid rgba($border-color, 0.6);
    color: $color-text-muted;
    &:hover:not(:disabled) { color: $color-text; border-color: rgba($border-color, 1); }
  }

  &--ghost {
    background: transparent;
    border: 1px solid rgba($color-danger, 0.4);
    color: $color-danger;
    &:hover:not(:disabled) { background: rgba($color-danger, 0.1); }
  }

  &--sm { padding: 4px 10px; font-size: $font-size-xs; }

  &:disabled { opacity: 0.5; cursor: not-allowed; }
}

.form-msg {
  font-size: $font-size-sm;
  font-weight: $font-weight-semibold;
  padding: $spacing-3 $spacing-4;
  border-radius: $border-radius-md;

  &--success {
    background: rgba($color-success, 0.12);
    color: $color-success;
    border: 1px solid rgba($color-success, 0.3);
  }

  &--error {
    background: rgba($color-danger, 0.12);
    color: $color-danger;
    border: 1px solid rgba($color-danger, 0.3);
  }
}

// ── Responsive ────────────────────────────────────────────────────────────────

@media (max-width: 900px) {
  .shop-banner {
    grid-template-columns: 1fr;

    &__stats {
      flex-direction: row;
      flex-wrap: wrap;
    }
  }

  .shop-stat {
    flex: 1 1 calc(50% - $spacing-2);
    flex-direction: column;
    align-items: flex-start;
    gap: $spacing-1;
  }

  .modal-form__grid,
  .modal-balance,
  .purchase-card__details,
  .purchase-card__edit-grid {
    grid-template-columns: 1fr;
  }

  .purchase-card__top {
    flex-direction: column;
  }

  .purchase-card__meta {
    justify-content: flex-start;
  }
}
</style>
