<template>
  <div class="page page--rules">
    <div class="rules-page">
      <header class="rules-page__head">
        <div class="rules-page__eyebrow">Limited Commander League</div>
        <input
          v-if="isAdmin"
          v-model="editableRules.title"
          class="rules-page__title rules-page__editor"
          aria-label="Rulebook title"
          @update:model-value="dirty = true"
        />
        <h1 v-else class="rules-page__title">{{ editableRules.title }}</h1>
        <UIRichTextEditor
          v-if="isAdmin"
          v-model="editableRules.subtitle"
          class="rules-page__subtitle"
          aria-label="Rulebook subtitle"
          @input="dirty = true"
        />
        <div v-else class="rules-page__subtitle rules-page__rich-text" v-html="editableRules.subtitle" />
        <div v-if="isAdmin" class="rules-page__admin-actions">
          <span>{{ dirty ? 'Unsaved changes' : 'Click any text to edit' }}</span>
          <button type="button" class="rules-page__save" :disabled="!dirty || saving" @click="saveRules">
            {{ saving ? 'Saving…' : 'Save rules' }}
          </button>
        </div>
      </header>

      <div v-if="loading" class="rules-page__loading">Loading rules…</div>
      <div v-else class="rules-page__sections">
        <article v-for="(section, index) in editableRules.sections" :key="index" class="rules-section">
          <input
            v-if="isAdmin"
            v-model="section.title"
            class="rules-section__title rules-page__editor"
            :aria-label="`Rule ${index + 1} heading`"
            @update:model-value="dirty = true"
          />
          <h2 v-else class="rules-section__title">{{ section.title }}</h2>
          <UIRichTextEditor
            v-if="isAdmin"
            v-model="section.body"
            class="rules-section__body"
            :aria-label="`Rule ${index + 1} text`"
            @input="dirty = true"
          />
          <div v-else-if="section.body" class="rules-section__body">
            <div class="rules-page__rich-text" v-html="section.body" />
          </div>
        </article>
      </div>
      <p v-if="errorMessage" class="rules-page__error">{{ errorMessage }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
type RuleSection = { title: string; body: string }
type LeagueRules = { title: string; subtitle: string; sections: RuleSection[] }

const { isAdmin } = useAuth()
const loading = ref(true)
const saving = ref(false)
const dirty = ref(false)
const errorMessage = ref('')

const defaultRules: LeagueRules = {
  title: 'Regelwerk: Limited Commander Langzeitliga',
  subtitle: 'Limited Commander League',
  sections: [
    { title: '1. Grundkonzept', body: 'Die Commander League ist eine einjährige Commander-Liga mit starkem Limited-Fokus.\n\nJede:r Spieler:in öffnet zu Beginn ein komplettes Play-Booster-Display. Aus diesem Display wird ein 100-Karten-Commander-Deck gebaut.\n\nIm weiteren Verlauf der Liga können Decks ausschließlich durch Karten erweitert werden, die in der Liga erspielt wurden.\n\nLeitgedanke der Liga\nAlle spielen mit ähnlichen, fairen Startbedingungen.\nDecks wachsen durchs Spiel und nicht durchs Geld.\nFairness, Kreativität und langfristiger Spielspaß stehen im Vordergrund.' },
    { title: '2. Einstiegsregelung', body: 'Der Einstieg erfolgt über ein Play-Booster-Display eines Standard Sets des letzten Jahres. Aus diesem Display wird ein Liga-Commander-Deck gebaut.\n\nAußerdem muss zum Einstieg das erste Produkt in den Preispool gegeben werden (siehe unten).\n\nSpieler:innen können bis zum 23.08. einsteigen. An diesem Tag muss das erste gültige Spiel eingetragen sein. Sonst ist kein Einstieg für das laufende Ligajahr mehr möglich.' },
    { title: '3. Deckbau-Regeln', body: 'Es gelten die offiziellen Deckbauregeln für constructed Commander.\n\nEs gilt die offizielle Commander Bannliste.\n\nDie Karten der offiziellen „Game-Changer“-Liste sind gebannt.' },
    { title: '4. Spielregeln', body: 'Es gelten die offiziellen Jede:r-Gegen-Jeden-Multiplayer Commander-Regeln.\n\nBei Einstimmigkeit dürfen Pauper-Commander-Regeln angewendet werden.\n\nEin Spiel ist gültig und kann angerechnet werden, sofern mind. 3 Ligamitglieder teilnehmen und nur Liga-Decks gespielt werden.\n\nEs dürfen nur 3er, 4er und 5er Commander-Runden gespielt werden.\n\nEs kann neben Paper auch in TTS oder einer anderen Onlineplattform gespielt werden.' },
    { title: '5. Kartenpool & Deckerweiterung', body: 'Erlaubte Kartenquellen:\nInitiales Play-Booster-Display\nLimited-Events der Liga (z. B. Draft, Sealed)\nKarten dürfen dem Pool nur hinzugefügt werden (z. B. durch Drafts), wenn beim jeweiligen Event mindestens 50 % der Ligamitglieder (aufgerundet) teilgenommen haben.\nBei solchen Events abwesende Ligateilnehmer:innen dürfen Booster des gespielten Sets gleicher Anzahl öffnen und ihrem Pool hinzufügen.\nPreisbooster, die im Rahmen dieser Events gewonnen werden\nLooster (siehe unten)\nKartentausch mit anderen Ligamitgliedern\n\nZusätzliche Regeln:\nExtern verkaufte Karten gelten als aus dem Liga-Pool entfernt.\nProxies sind nicht erlaubt (sollte noch einmal abgestimmt werden).\nBasic-Länder dürfen frei hinzugefügt werden.\n\nExterne Kartenquellen sind verboten, u. a.:\nCardmarket oder andere Händler\nTausch mit Nicht-Liga-Spieler:innen\nKarten aus der eigenen privaten Sammlung' },
    { title: '6. „L-Punkte“', body: 'Jede Platzierung in einem gültigen Ligaspiel bringt L-Punkte wie nachfolgend:\n\n1. Platz → 0 L-Punkte\n2. Platz → 2 L-Punkte\n3. Platz → 3 L-Punkte\n4. Platz → 4 L-Punkte\n5. Platz → 5 L-Punkte\n\nLigamitglieder, die an einem Spiel nicht teilnehmen, erhalten automatisch einen L-Punkt.' },
    { title: '7. Looster-Belohnungen', body: 'Für 8 gesammelte L-Punkte darf ein Ligamitglied einen Looster öffnen.\n\nEin Looster darf nur geöffnet werden, wenn das Mitglied über ein entsprechendes Guthaben im Preispool in Höhe der Booster-Kosten verfügt (siehe Regelung zum Preispool).\n\nAls Looster dürfen Draft-Booster oder Play-Booster aus einem Base-Set oder Expansion-Set gewählt werden. Sets, die nicht in diesen beiden Kategorien gelistet sind, dürfen nicht als Looster geöffnet werden.\n\nDer Inhalt geöffneter Looster darf vollständig dem Liga-Pool sowie den Liga-Decks hinzugefügt werden.\n\nDas Öffnen von Loostern muss von mind. einem anderen Ligamitglied bezeugt werden!' },
    { title: '8. Ranking', body: 'Die Ligatabelle wird nach dem Player Rating sortiert. Ein höheres Player Rating bedeutet eine bessere Platzierung in der Liga.\n\nDas Player Rating bewertet nicht nur einzelne Siege, sondern die langfristige Gesamtleistung einer Spieler*in. Dafür werden mehrere Faktoren berechnet, auf eine gemeinsame Skala gebracht und gewichtet zusammengeführt.\n\nSeason Rating (40 %): Bewertet die Leistung innerhalb der laufenden Saison und ist damit einer der wichtigsten Faktoren für die aktuelle Tabellenplatzierung.\n\nDurchschnittliche Commander-MMR (40 %): Belohnt einen dauerhaft starken und erfolgreichen Commander-Pool.\n\nLeistung gegen stärkere Commander (5 %): Bewertet, ob ein Commander besser abschneidet, als es anhand seiner Commander-MMR im jeweiligen Pod zu erwarten gewesen wäre.\n\nAktivität (5 %): Berücksichtigt erspielte Punkte und regelmäßige Teilnahme.\n\nWinrate (5 %): Belohnt, wie häufig Spiele gewonnen werden.\n\nClutch-Leistung (5 %): Belohnt besonders starke Siege und übertroffene Erwartungen in anspruchsvollen Pods.\n\nDie Gewichtungen können durch die Ligaverwaltung angepasst werden.\n\nCommander-MMR\nJeder Commander besitzt eine eigene Commander-MMR. Sie beschreibt die aktuelle Spielstärke dieses konkreten Decks und wird nach jedem gültigen Ligaspiel angepasst.\n\nFür die Berechnung wird ein Pod in direkte Vergleiche zwischen allen beteiligten Commandern aufgeteilt:\n\nEin Commander gewinnt den direkten Vergleich gegen jeden Commander, der schlechter platziert ist.\nGegen Commander mit derselben Platzierung endet der direkte Vergleich unentschieden.\nEin Sieg gegen einen höher bewerteten Commander bringt mehr MMR.\nEine Niederlage gegen einen niedriger bewerteten Commander kostet mehr MMR.\nDie Änderungen aus allen direkten Vergleichen werden zu einer MMR-Änderung für den gespielten Commander zusammengefasst.\n\nDie Commander-MMR ist nicht allein entscheidend für den Tabellenplatz. Sie beeinflusst das Player Rating durch die Stärke des gesamten Commander-Pools und durch die Frage, ob ein Commander in schwierigen Pods besser oder schlechter als erwartet abschneidet.\n\nNeue oder selten gespielte Commander werden bei der Bewertung vorsichtiger eingeordnet. Mit zunehmender Spielanzahl wird die Bewertung aussagekräftiger.' },
    { title: '9. Preis-Pool', body: 'Der Preispool wird gemeinschaftlich von den Mitgliedern der Liga gestaltet.\n\nJedes Mitglied steuert Produkte zum Preispool bei. Der Gesamtwert der eingebrachten Produkte bestimmt gleichzeitig den maximalen Wert der Booster, die im Gegenzug geöffnet werden dürfen.\n\nBeispiel:\nBringt Spieler A ein Produkt im Wert von 20 € in den Preispool ein, so darf er – vorausgesetzt, er verfügt über ausreichend L-Punkte – Booster im Gesamtwert von bis zu 20 € öffnen. Sobald dieser Wert erreicht ist, muss der Spieler erneut ein Produkt in den Preispool einbringen, um weitere Booster öffnen zu dürfen.\n\nDie eingebrachten Produkte sollten thematisch im weitesten Sinne mit Magic: The Gathering (MtG) oder zumindest mit Trading Card Games (TCG) verbunden sein, insbesondere wenn es sich um Zubehör handelt. Dabei ist der gesunde Menschenverstand maßgeblich: Wählt idealerweise Produkte, über die ihr euch selbst freuen würdet, wenn ihr sie als Gewinn auswählen dürftet.' },
  ],
}

const editableRules = reactive<LeagueRules>(toRichTextRules(defaultRules))

onMounted(async () => {
  try {
    const response = await $fetch<{ rules: LeagueRules | null }>('/api/rules')
    if (response.rules) Object.assign(editableRules, toRichTextRules(response.rules))
  } catch {
    errorMessage.value = 'The rules could not be loaded. Showing the default rulebook.'
  } finally {
    loading.value = false
  }
})

async function saveRules() {
  saving.value = true
  errorMessage.value = ''
  try {
    const response = await $fetch<{ rules: LeagueRules }>('/api/rules', {
      method: 'PUT',
      body: { rules: editableRules },
    })
    Object.assign(editableRules, toRichTextRules(response.rules))
    dirty.value = false
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage ?? 'Could not save the rules.'
  } finally {
    saving.value = false
  }
}

function toRichTextRules(rules: LeagueRules): LeagueRules {
  return {
    ...structuredClone(rules),
    subtitle: toHtml(rules.subtitle),
    sections: rules.sections.map((section) => ({ ...section, body: toHtml(section.body) })),
  }
}

function toHtml(value: string) {
  if (/<[a-z][\s\S]*>/i.test(value)) return value
  return value
    .split(/\n\n+/)
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char] ?? char)
}
</script>

<style lang="scss" scoped>
.rules-page { max-width: 860px; margin: 0 auto; padding: $spacing-8 $spacing-4 $spacing-8; }

.rules-page__head { padding-bottom: $spacing-6; margin-bottom: $spacing-6; border-bottom: 1px solid rgba($color-primary-light, .16); }
.rules-page__eyebrow { color: $color-primary-light; font-size: $font-size-xs; font-weight: $font-weight-semibold; letter-spacing: .14em; text-transform: uppercase; }
.rules-page__title { display: block; width: 100%; margin: $spacing-2 0; color: $color-accent; font: inherit; font-size: clamp(1.4rem, 2.6vw, 1.75rem); font-weight: $font-weight-bold; letter-spacing: .01em; line-height: 1.25; }
.rules-page__subtitle { display: block; width: 100%; max-width: 640px; margin: 0; color: $color-text-muted; font-size: $font-size-base; line-height: 1.6; }

.rules-page__sections { display: grid; gap: $spacing-4; }
.rules-section {
  padding: $spacing-4 $spacing-6;
  border: 1px solid rgba($color-primary-light, .16);
  border-radius: $border-radius-lg;
  background:
    linear-gradient(180deg, rgba($color-primary, .06), rgba(255, 255, 255, .015)),
    rgba(10, 12, 20, .4);
}
.rules-section__title { display: block; width: 100%; margin: 0 0 $spacing-3; color: $color-accent; font: inherit; font-size: $font-size-lg; font-weight: $font-weight-bold; letter-spacing: .01em; }
.rules-section__body { display: block; width: 100%; margin: 0; color: rgba($color-text, .7); font: inherit; font-size: $font-size-sm; line-height: 1.7; }
.rules-page__rich-text :deep(p), .rules-page__rich-text :deep(h3) { margin: 0 0 $spacing-3; }
.rules-page__rich-text :deep(p:last-child), .rules-page__rich-text :deep(h3:last-child) { margin-bottom: 0; }
.rules-page__rich-text :deep(ul), .rules-page__rich-text :deep(ol) { margin: 0 0 $spacing-3; padding-left: 1.4rem; }
.rules-page__rich-text :deep(strong), .rules-page__rich-text :deep(b),
.rules-section__body :deep(strong), .rules-section__body :deep(b),
.rules-page__subtitle :deep(strong), .rules-page__subtitle :deep(b) { color: $color-text; font-weight: $font-weight-semibold; }

.rules-section:nth-of-type(3n+1) .rules-page__rich-text :deep(h3) { color: $color-primary-light; }
.rules-section:nth-of-type(3n+2) .rules-page__rich-text :deep(h3) { color: $color-secondary; }
.rules-section:nth-of-type(3n+3) .rules-page__rich-text :deep(h3) { color: $color-accent; }

.rules-page__editor { box-sizing: border-box; padding: 2px 4px; margin-left: -4px; border: 1px solid transparent; border-radius: $border-radius-sm; outline: none; background: transparent; resize: vertical; transition: border-color $transition-fast, background $transition-fast; }
.rules-page__editor:hover, .rules-page__editor:focus { border-color: rgba($color-primary-light, .5); background: rgba($color-primary, .09); }
.rules-page__admin-actions { display: flex; align-items: center; justify-content: space-between; gap: $spacing-3; margin-top: $spacing-4; color: $color-text-muted; font-size: $font-size-xs; }
.rules-page__save { padding: $spacing-2 $spacing-3; border: 1px solid rgba($color-primary-light, .4); border-radius: $border-radius-md; background: rgba($color-primary, .14); color: $color-text; font: inherit; font-size: $font-size-xs; font-weight: $font-weight-semibold; cursor: pointer; transition: background $transition-fast, border-color $transition-fast; }
.rules-page__save:hover:not(:disabled) { background: rgba($color-primary, .24); border-color: rgba($color-primary-light, .6); }
.rules-page__save:disabled { cursor: default; opacity: .5; }
.rules-page__loading, .rules-page__error { color: $color-text-muted; }
.rules-page__error { color: $color-danger; margin-top: $spacing-3; }
</style>
