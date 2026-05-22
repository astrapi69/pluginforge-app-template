/**
 * AI provider presets for the Settings UI.
 *
 * Each preset defines the base_url, default_model, and whether
 * an API key is required. Model suggestions are hints - users
 * can enter any model string.
 */

export interface ProviderPreset {
  id: string
  label: string
  base_url: string
  default_model: string
  model_suggestions: string[]
  requires_api_key: boolean
}

export const AI_PROVIDER_PRESETS: Record<string, ProviderPreset> = {
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    base_url: 'https://api.anthropic.com/v1',
    default_model: 'claude-sonnet-4-20250514',
    model_suggestions: [
      'claude-opus-4-20250514',
      'claude-sonnet-4-20250514',
      'claude-haiku-4-5-20251001',
    ],
    requires_api_key: true,
  },
  openai: {
    id: 'openai',
    label: 'OpenAI (GPT)',
    base_url: 'https://api.openai.com/v1',
    default_model: 'gpt-4o',
    model_suggestions: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
    requires_api_key: true,
  },
  google: {
    id: 'google',
    label: 'Google (Gemini)',
    base_url: 'https://generativelanguage.googleapis.com/v1beta/openai',
    default_model: 'gemini-2.0-flash',
    model_suggestions: ['gemini-2.0-flash', 'gemini-1.5-pro'],
    requires_api_key: true,
  },
  mistral: {
    id: 'mistral',
    label: 'Mistral',
    base_url: 'https://api.mistral.ai/v1',
    default_model: 'mistral-large-latest',
    model_suggestions: [
      'mistral-large-latest',
      'mistral-medium-latest',
      'mistral-small-latest',
    ],
    requires_api_key: true,
  },
  lmstudio: {
    id: 'lmstudio',
    label: 'LM Studio (local)',
    base_url: 'http://localhost:1234/v1',
    default_model: '',
    model_suggestions: [],
    requires_api_key: false,
  },
  // UNIVERSAL-AI-TEMPLATE-02 Session 2 commit 9 (Q11 (a)+(b)):
  // explicit "Custom" option for arbitrary OpenAI-compatible
  // endpoints (Ollama, vLLM, self-hosted gateways, ...). The
  // backend's ``detect_provider`` already returns "custom" for
  // any URL not matching a known preset; this entry just gives
  // the UI a labelled dropdown option so users don't have to
  // hand-type a base_url onto an existing preset and rely on
  // detection. base_url + default_model start empty so the
  // preset-select handler does not overwrite user input.
  custom: {
    id: 'custom',
    label: 'Custom (OpenAI-compatible)',
    base_url: '',
    default_model: '',
    model_suggestions: [],
    requires_api_key: false,
  },
}

export const AI_PROVIDER_IDS = Object.keys(AI_PROVIDER_PRESETS)

export function getProviderPreset(providerId: string): ProviderPreset | undefined {
  return AI_PROVIDER_PRESETS[providerId]
}

// Source of an API key as reported by GET /api/settings/app's
// _secret_sources meta-field. "settings" means the key is editable
// in the UI; "file" / "env" mean it is owned by ~/.config/myapp/
// secrets.yaml or an environment variable and the input must be
// disabled.
export type SecretSource = 'settings' | 'file' | 'env'

// Per-provider dotted-path mapping into the merged app-config dict.
// Providers not in the map fall back to the legacy ai.api_key slot
// (still consumed by app/main.py:735 and app/ai/routes.py:120 until
// the AI-routes migration that retires it).
const PER_PROVIDER_KEY_PATH: Record<string, string> = {
  anthropic: 'ai.anthropic.api_key',
  openai: 'ai.openai.api_key',
  gemini: 'ai.gemini.api_key',
}

export function activeKeyPath(provider: string): string {
  return PER_PROVIDER_KEY_PATH[provider] ?? 'ai.api_key'
}

export function activeKeySource(
  provider: string,
  sources?: Record<string, string>,
): SecretSource {
  if (!sources) return 'settings'
  const raw = sources[activeKeyPath(provider)] ?? 'settings'
  return raw === 'file' || raw === 'env' ? raw : 'settings'
}
