import { englishLabel, LABEL_KEYS, type LabelKey, setLabels } from '@nib/editor'
import { de } from '../locales/de'
import { fr } from '../locales/fr'
import { gsw } from '../locales/gsw'
import { ja } from '../locales/ja'

/** The English string is its own key. A language that has not translated
 *  something falls back to it, so nothing can ever come out blank. */
export type Dictionary = Record<string, string>

export const LANGUAGES = [
  { id: 'system', name: 'Match the system' },
  { id: 'en', name: 'English' },
  { id: 'de', name: 'Deutsch' },
  { id: 'gsw', name: 'Schwiizerdütsch' },
  { id: 'fr', name: 'Français' },
  { id: 'ja', name: '日本語' },
] as const

const DICTIONARIES: Record<string, Dictionary> = { de, gsw, fr, ja }

const STORAGE_KEY = 'nib:language'

function systemLanguage(): string {
  return (navigator.language || 'en').slice(0, 2).toLowerCase()
}

class I18n {
  /** `system`, or a language chosen explicitly. */
  choice = $state('system')

  readonly language = $derived(this.choice === 'system' ? systemLanguage() : this.choice)
  private readonly dictionary = $derived(DICTIONARIES[this.language] ?? {})

  restore() {
    this.choice = localStorage.getItem(STORAGE_KEY) ?? 'system'
    document.documentElement.lang = this.language
    this.translateEditor()
  }

  select(id: string) {
    this.choice = id
    localStorage.setItem(STORAGE_KEY, id)
    document.documentElement.lang = this.language
    this.translateEditor()
  }

  /** The editor package has its own handful of labels; hand it ours. */
  private translateEditor() {
    setLabels(
      Object.fromEntries(LABEL_KEYS.map((key) => [key, this.t(englishLabel(key))])) as Record<
        LabelKey,
        string
      >,
    )
  }

  /** Translates one string, filling in `{name}` placeholders. */
  t(text: string, values?: Record<string, string | number>): string {
    const translated = this.dictionary[text] ?? text
    if (!values) return translated

    return translated.replace(/\{(\w+)\}/g, (whole, name: string) =>
      name in values ? String(values[name]) : whole,
    )
  }
}

export const i18n = new I18n()

/** Shorthand, so a component reads `{t('Save')}` rather than `{i18n.t('Save')}`. */
export const t = (text: string, values?: Record<string, string | number>) => i18n.t(text, values)
