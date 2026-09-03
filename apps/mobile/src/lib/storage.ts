import AsyncStorage from "@react-native-async-storage/async-storage"

/* ------------------------------------------------------------------ *
 * persisted keys
 *
 * The web app keeps the same things in localStorage under `screenkit-*`
 * and `mixture-*`; AsyncStorage is the android equivalent, so the key
 * names are kept identical to make a future export/import trivial.
 * ------------------------------------------------------------------ */

export const KEYS = {
  settings: "screenkit-mobile-settings-v1",
  onboarding: "screenkit-mobile-onboarding-v1",
  favorites: "screenkit-favorites-v1",
  wizardDraft: "screenkit-wizard-draft-v1",
  editToken: "mixture-edit-token",
  cloudToken: "mixture-cloud-token",
  cloudKey: "mixture-cloud-key",
  localRoot: "screenkit-mobile-local-root-v1",
} as const

export async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    // corrupted json or a storage failure: behave as if nothing was saved
    return null
  }
}

export async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value))
  } catch {
    // quota or a locked database: the in-memory value still serves the session
  }
}

export async function readText(key: string): Promise<string> {
  try {
    return (await AsyncStorage.getItem(key)) ?? ""
  } catch {
    return ""
  }
}

export async function writeText(key: string, value: string): Promise<void> {
  try {
    if (value) await AsyncStorage.setItem(key, value)
    else await AsyncStorage.removeItem(key)
  } catch {
    // ignore
  }
}

/** the onboarding screen is offered once; "skip for now" also counts as seen */
export const markOnboardingSeen = () => writeText(KEYS.onboarding, "seen")

export async function remove(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key)
  } catch {
    // ignore
  }
}
