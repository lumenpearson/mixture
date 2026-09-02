"use client"

import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { cloudClient, rpcErrorMessage } from "@/lib/rpc/client"
import { cn } from "@/lib/utils"
import { create } from "@bufbuild/protobuf"
import { ConfigSchema, Role, Visibility, type Config } from "@mixture/protocol/cloud"
import { Check, Copy, KeyRound, Loader2, Plus, Save, Trash2 } from "lucide-react"
import * as React from "react"
import { toast } from "sonner"
import { Explain, SectionHeading } from "./primitives"
import { useScreenkit } from "./store"

/* ------------------------------------------------------------------ *
 * cloud access editor — edits cloud.config.json through CloudService
 *
 * Editors may read the config; only owners may save it. Access keys are
 * generated in the browser and only their sha256 leaves it.
 * ------------------------------------------------------------------ */

const VISIBILITIES: { value: Visibility; key: string }[] = [
  { value: Visibility.PRIVATE, key: "cloud.visibility.private" },
  { value: Visibility.PUBLIC, key: "cloud.visibility.public" },
  { value: Visibility.HIDDEN, key: "cloud.visibility.hidden" },
]

const KEY_ROLES: { value: Role; key: string }[] = [
  { value: Role.VIEWER, key: "cloud.role.viewer" },
  { value: Role.EDITOR, key: "cloud.role.editor" },
  { value: Role.OWNER, key: "cloud.role.owner" },
]

const inputCls =
  "h-10 rounded-xl border-panel-border bg-control font-mono text-sm text-foreground placeholder:text-text-faint focus-visible:ring-ring"
const triggerCls =
  "h-10 rounded-xl border-panel-border bg-control font-mono text-xs lowercase text-foreground focus:ring-ring"

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest("SHA-256", data)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("")
}

function randomKey(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  const base64 = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
  return `mx_${base64}`
}

const splitLogins = (value: string) =>
  value
    .split(/[\s,]+/)
    .map((v) => v.trim())
    .filter(Boolean)

export function CloudAccessEditor({ canSave }: { canSave: boolean }) {
  const { t } = useScreenkit()
  const [config, setConfig] = React.useState<Config | null>(null)
  const [sha, setSha] = React.useState("")
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [owners, setOwners] = React.useState("")
  const [editors, setEditors] = React.useState("")
  const [viewers, setViewers] = React.useState("")
  const [freshKey, setFreshKey] = React.useState<{ name: string; key: string } | null>(null)
  const [copied, setCopied] = React.useState(false)
  const [newKeyName, setNewKeyName] = React.useState("")
  const [newKeyRole, setNewKeyRole] = React.useState<Role>(Role.VIEWER)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const response = await cloudClient().getConfig({})
      const next = response.config ?? create(ConfigSchema, {})
      setConfig(next)
      setSha(response.sha)
      setOwners((next.access?.owners ?? []).join(", "))
      setEditors((next.access?.editors ?? []).join(", "))
      setViewers((next.access?.viewers ?? []).join(", "))
    } catch (error) {
      toast.error(rpcErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  const update = (patch: (draft: Config) => void) => {
    setConfig((current) => {
      if (!current) return current
      const draft = create(ConfigSchema, current)
      patch(draft)
      return draft
    })
  }

  const ensureAccess = (draft: Config) => {
    if (!draft.access) {
      draft.access = { $typeName: "mixture.cloud.v1.Access", owners: [], editors: [], viewers: [], allowAnonymousPublic: true, keys: [] }
    }
    return draft.access
  }

  const addKey = async () => {
    const name = newKeyName.trim()
    if (!name) return
    const raw = randomKey()
    const hash = await sha256Hex(raw)
    update((draft) => {
      const access = ensureAccess(draft)
      access.keys = [...access.keys.filter((k) => k.name !== name), { $typeName: "mixture.cloud.v1.AccessKey", name, role: newKeyRole, keyHash: hash }]
    })
    setFreshKey({ name, key: raw })
    setCopied(false)
    setNewKeyName("")
  }

  const save = async () => {
    if (!config) return
    setSaving(true)
    try {
      const draft = create(ConfigSchema, config)
      const access = ensureAccess(draft)
      access.owners = splitLogins(owners)
      access.editors = splitLogins(editors)
      access.viewers = splitLogins(viewers)
      const response = await cloudClient().updateConfig({ config: draft, sha })
      if (response.config) setConfig(response.config)
      setSha(response.sha)
      setFreshKey(null)
      toast.success(t("cloud.access.saved"))
    } catch (error) {
      toast.error(rpcErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  if (loading || !config) {
    return (
      <div className="flex items-center gap-2 rounded-3xl border border-panel-border bg-panel-soft p-5 font-mono text-[12px] lowercase text-text-muted">
        <Loader2 className="size-3.5 animate-spin" /> {t("common.loading")}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 rounded-3xl border border-panel-border bg-panel-soft p-4 sm:p-5">
      <div className="flex flex-col gap-2">
        <SectionHeading title={t("cloud.access.title")} />
        <Explain>{t("cloud.access.desc")}</Explain>
        {!canSave ? <span className="font-mono text-[11px] lowercase text-accent-orange">{t("cloud.access.ownerOnly")}</span> : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <Field label={t("cloud.access.defaultVisibility")}>
          <Select
            value={String(config.defaultVisibility || Visibility.PRIVATE)}
            onValueChange={(value) => update((draft) => void (draft.defaultVisibility = Number(value) as Visibility))}
          >
            <SelectTrigger className={cn(triggerCls, "w-full sm:w-56")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VISIBILITIES.map((v) => (
                <SelectItem key={v.value} value={String(v.value)} className="font-mono text-xs lowercase">
                  {t(v.key)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <label className="flex items-center justify-between gap-3 rounded-2xl border border-panel-border bg-control px-4 py-2.5 sm:w-fit">
          <span className="font-mono text-[12px] lowercase text-text-secondary">{t("cloud.access.anonymousPublic")}</span>
          <Switch
            checked={config.access?.allowAnonymousPublic ?? true}
            onCheckedChange={(checked) => update((draft) => void (ensureAccess(draft).allowAnonymousPublic = checked))}
          />
        </label>
      </div>

      <div className="flex flex-col gap-3">
        <SectionHeading title={t("cloud.access.rules")} />
        <div className="flex flex-col gap-2">
          {config.rules.map((rule, index) => (
            <div key={index} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_11rem_auto]">
              <Input
                value={rule.pattern}
                placeholder={t("cloud.access.pattern")}
                onChange={(e) => update((draft) => void (draft.rules[index]!.pattern = e.target.value))}
                className={inputCls}
              />
              <Select
                value={String(rule.visibility || Visibility.PRIVATE)}
                onValueChange={(value) => update((draft) => void (draft.rules[index]!.visibility = Number(value) as Visibility))}
              >
                <SelectTrigger className={triggerCls}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VISIBILITIES.map((v) => (
                    <SelectItem key={v.value} value={String(v.value)} className="font-mono text-xs lowercase">
                      {t(v.key)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <IconButton label={t("cloud.access.removeKey")} onClick={() => update((draft) => void draft.rules.splice(index, 1))}>
                <Trash2 className="size-3.5" />
              </IconButton>
            </div>
          ))}
          <button
            type="button"
            onClick={() => update((draft) => void draft.rules.push({ $typeName: "mixture.cloud.v1.VisibilityRule", pattern: "", visibility: Visibility.PRIVATE }))}
            className="inline-flex w-fit items-center gap-1.5 rounded-xl border border-panel-border bg-control px-3 py-2 font-mono text-xs lowercase text-foreground transition-colors hover:bg-panel-hover"
          >
            <Plus className="size-3.5" /> {t("cloud.access.addRule")}
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Field label={t("cloud.access.owners")} hint={t("cloud.access.loginsHint")}>
          <Textarea value={owners} onChange={(e) => setOwners(e.target.value)} rows={2} className={cn(inputCls, "h-auto")} />
        </Field>
        <Field label={t("cloud.access.editors")} hint={t("cloud.access.loginsHint")}>
          <Textarea value={editors} onChange={(e) => setEditors(e.target.value)} rows={2} className={cn(inputCls, "h-auto")} />
        </Field>
        <Field label={t("cloud.access.viewers")} hint={t("cloud.access.loginsHint")}>
          <Textarea value={viewers} onChange={(e) => setViewers(e.target.value)} rows={2} className={cn(inputCls, "h-auto")} />
        </Field>
      </div>

      <div className="flex flex-col gap-3">
        <SectionHeading title={t("cloud.access.keys")} />
        <Explain>{t("cloud.access.keysDesc")}</Explain>
        <div className="flex flex-col gap-2">
          {(config.access?.keys ?? []).map((key) => (
            <div key={key.name} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-panel-border bg-control px-3 py-2">
              <span className="inline-flex min-w-0 items-center gap-2 font-mono text-[12px] lowercase text-foreground">
                <KeyRound className="size-3.5 shrink-0 text-text-faint" />
                <span className="truncate">{key.name}</span>
                <span className="rounded-full bg-panel-soft px-2 py-0.5 text-[10px] text-text-secondary">
                  {t(KEY_ROLES.find((r) => r.value === key.role)?.key ?? "cloud.role.viewer")}
                </span>
              </span>
              {canSave ? (
                <IconButton
                  label={t("cloud.access.removeKey")}
                  onClick={() => update((draft) => void (ensureAccess(draft).keys = ensureAccess(draft).keys.filter((k) => k.name !== key.name)))}
                >
                  <Trash2 className="size-3.5" />
                </IconButton>
              ) : null}
            </div>
          ))}
        </div>
        {canSave ? (
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_auto]">
            <Input value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder={t("cloud.access.keyName")} className={inputCls} />
            <Select value={String(newKeyRole)} onValueChange={(value) => setNewKeyRole(Number(value) as Role)}>
              <SelectTrigger className={triggerCls}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KEY_ROLES.map((r) => (
                  <SelectItem key={r.value} value={String(r.value)} className="font-mono text-xs lowercase">
                    {t(r.key)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              type="button"
              onClick={() => void addKey()}
              disabled={!newKeyName.trim()}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-panel-border bg-control px-3 py-2 font-mono text-xs lowercase text-foreground transition-colors hover:bg-panel-hover disabled:opacity-50"
            >
              <Plus className="size-3.5" /> {t("cloud.access.generateKey")}
            </button>
          </div>
        ) : null}
        {freshKey ? (
          <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-accent-green/60 bg-control px-4 py-3">
            <span className="font-mono text-[11px] lowercase text-text-secondary">
              {t("cloud.access.keyGenerated")} <span className="text-foreground">{freshKey.name}</span>
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <code className="min-w-0 break-all rounded-lg bg-panel-soft px-2 py-1 font-mono text-[12px] text-foreground">{freshKey.key}</code>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(freshKey.key)
                  setCopied(true)
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-panel-border bg-control px-2.5 py-1 font-mono text-[11px] lowercase text-text-secondary transition-colors hover:bg-panel-hover hover:text-foreground"
              >
                {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
                {copied ? t("common.copied") : t("common.copy")}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {canSave ? (
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="inline-flex w-fit items-center gap-2 rounded-xl bg-control-active px-4 py-2.5 font-mono text-sm lowercase text-control-active-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {t("cloud.access.save")}
        </button>
      ) : null}
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="font-mono text-[11px] lowercase text-text-secondary">
        {label}
        {hint ? <span className="ml-1 text-text-faint">— {hint}</span> : null}
      </span>
      {children}
    </div>
  )
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="inline-flex size-10 items-center justify-center rounded-xl border border-panel-border bg-control text-text-secondary transition-colors hover:bg-panel-hover hover:text-foreground"
    >
      {children}
    </button>
  )
}
