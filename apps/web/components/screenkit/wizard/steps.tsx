"use client"

import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { formatBytes } from "@/lib/media/kinds"
import { normalizeHttpUrl } from "@/lib/media/url"
import { cloudClient, rpcErrorMessage } from "@/lib/rpc/client"
import { RPC_MAX_MESSAGE_BYTES } from "@/lib/rpc/limits"
import { ASPECTS, DEVICES, STATUSES } from "@/lib/screenkit/data"
import { deviceLabel, statusLabel } from "@/lib/screenkit/i18n"
import { sceneManifests } from "@/lib/screenkit/insert-registry"
import type { AspectRatio, DeviceType, InsertKind, InsertStatus, Locale, ResolvedInsert } from "@/lib/screenkit/types"
import { cn } from "@/lib/utils"
import type { Entry } from "@mixture/protocol/cloud"
import { Check, Loader2, Upload } from "lucide-react"
import * as React from "react"
import { toast } from "sonner"
import { InsertPreview } from "../insert-preview"
import { invalidateCloudTree } from "../media/use-cloud-tree"
import { Explain, KeyVal, SegmentedControl } from "../primitives"
import { useScreenkit } from "../store"
import { splitLines, suggestSlug, type WizardDraft } from "./draft"
import { KIND_ART } from "./kind-art"

export type StepProps = {
  draft: WizardDraft
  update: (patch: Partial<WizardDraft>) => void
}

const KIND_ACCENT: Record<InsertKind, string> = {
  scene: "var(--accent-blue)",
  site: "var(--accent-cyan)",
  file: "var(--accent-purple)",
}

const inputCls =
  "h-10 rounded-xl border-panel-border bg-control font-mono text-sm text-foreground placeholder:text-text-faint focus-visible:ring-ring"
const areaCls =
  "rounded-xl border-panel-border bg-control font-mono text-sm text-foreground placeholder:text-text-faint focus-visible:ring-ring"
const triggerCls = "h-10 rounded-xl border-panel-border bg-control font-mono text-sm lowercase text-foreground focus:ring-ring"

/* ------------------------------ helpers ------------------------------ */

/** the draft as a resolved insert, for live previews */
export function draftToInsert(draft: WizardDraft, locale: Locale): ResolvedInsert {
  const pick = (ru: string, en: string) => (locale === "en" && en.trim() ? en : ru)
  return {
    id: "wizard-draft",
    date: draft.date,
    episode: draft.episode || "ep-01",
    scene: draft.scene || "sc-01",
    category: draft.category,
    device: draft.device,
    aspect: draft.aspect,
    status: draft.status,
    title: pick(draft.titleRu, draft.titleEn) || "—",
    description: pick(draft.descriptionRu, draft.descriptionEn),
    prompt: pick(draft.promptRu, draft.promptEn),
    shortPrompt: pick(draft.shortPromptRu, draft.shortPromptEn),
    negativePrompt: pick(draft.negativePromptRu, draft.negativePromptEn),
    technicalNotes: splitLines(locale === "en" && draft.technicalNotesEn.trim() ? draft.technicalNotesEn : draft.technicalNotesRu),
    hasEnglish: Boolean(draft.titleEn.trim()),
    custom: true,
    kind: draft.kind,
    // both live kinds render the url: a half-typed or `javascript:` one must
    // not reach the iframe or the media element of the live preview
    source: draft.kind === "scene" ? draft.source : { ...draft.source, url: normalizeHttpUrl(draft.source.url) || undefined },
  }
}

export function DraftPreview({ draft, className }: { draft: WizardDraft; className?: string }) {
  const { preview, contentLocale } = useScreenkit()
  const insert = React.useMemo(() => draftToInsert(draft, contentLocale), [draft, contentLocale])
  const settings = React.useMemo(() => ({ ...preview, device: draft.device, aspect: draft.aspect }), [preview, draft.device, draft.aspect])
  return (
    <div className={cn("flex items-center justify-center overflow-hidden rounded-2xl border border-panel-border bg-[radial-gradient(120%_120%_at_50%_0%,#0e0e10,#000)] p-3 sm:p-4", className)}>
      <InsertPreview insert={insert} settings={settings} className="max-w-[240px]" />
    </div>
  )
}

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="font-mono text-[11px] lowercase text-text-secondary">
        {label}
        {required ? <span className="ml-0.5 text-accent-orange">*</span> : null}
        {hint ? <span className="ml-1 text-text-faint">— {hint}</span> : null}
      </span>
      {children}
    </label>
  )
}

function Toggle({ title, desc, checked, onChange }: { title: string; desc: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-panel-border bg-control px-4 py-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="font-mono text-sm lowercase text-foreground">{title}</span>
        <span className="font-mono text-[11px] text-text-muted">{desc}</span>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

function StepIntro({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="font-mono text-base font-bold lowercase text-foreground">{title}</h3>
      <Explain>{desc}</Explain>
    </div>
  )
}

/* ------------------------------ 1 · kind ------------------------------ */

export function KindStep({ draft, update }: StepProps) {
  const { t } = useScreenkit()
  const kinds: InsertKind[] = ["scene", "site", "file"]
  return (
    <div className="flex flex-col gap-5">
      <StepIntro title={t("wizard.kind.title")} desc={t("wizard.kind.desc")} />
      <div className="grid gap-3 sm:grid-cols-3">
        {kinds.map((kind) => {
          const Art = KIND_ART[kind]
          const selected = draft.kind === kind
          return (
            <button
              key={kind}
              type="button"
              onClick={() => update(kind === draft.kind ? {} : { kind, source: {}, sceneKey: "" })}
              aria-pressed={selected}
              className={cn(
                "group flex flex-col gap-3 rounded-2xl border p-4 text-left transition-colors",
                selected ? "border-ring bg-panel-hover" : "border-panel-border bg-panel-soft hover:border-ring hover:bg-panel-hover",
              )}
              style={{ color: KIND_ACCENT[kind] }}
            >
              <Art className="h-20 w-full opacity-90 transition-transform group-hover:scale-[1.03]" />
              <span className="flex items-center gap-2 font-mono text-sm lowercase text-foreground">
                {t(`kind.${kind}`)}
                {selected ? <Check className="size-3.5" style={{ color: KIND_ACCENT[kind] }} /> : null}
              </span>
              <span className="font-mono text-[12px] leading-relaxed text-text-muted">{t(`kind.${kind}Desc`)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ------------------------------ 2 · source ------------------------------ */

export function SourceStep({ draft, update }: StepProps) {
  if (draft.kind === "site") return <SiteSource draft={draft} update={update} />
  if (draft.kind === "file") return <FileSource draft={draft} update={update} />
  return <SceneSource draft={draft} update={update} />
}

function SceneSource({ draft, update }: StepProps) {
  const { t, catLabel } = useScreenkit()
  const manifests = React.useMemo(() => [...sceneManifests].sort((a, b) => a.label.localeCompare(b.label)), [])
  return (
    <div className="flex flex-col gap-5">
      <StepIntro title={t("wizard.source.sceneTitle")} desc={t("wizard.source.sceneDesc")} />
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_260px]">
        <ul className="sk-scroll flex max-h-80 flex-col gap-1 overflow-y-auto rounded-2xl border border-panel-border bg-control p-1.5">
          {manifests.map((manifest) => {
            const selected = draft.sceneKey === manifest.key
            return (
              <li key={manifest.key}>
                <button
                  type="button"
                  onClick={() =>
                    update({
                      sceneKey: manifest.key,
                      category: manifest.categories?.[0] ? String(manifest.categories[0]) : draft.category,
                    })
                  }
                  aria-pressed={selected}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition-colors",
                    selected ? "bg-control-active text-control-active-foreground" : "hover:bg-panel-hover",
                  )}
                >
                  <span className="min-w-0 truncate font-mono text-[12px] lowercase">{manifest.label}</span>
                  <span className={cn("shrink-0 font-mono text-[10px] lowercase", selected ? "opacity-70" : "text-text-faint")}>
                    {manifest.categories?.map((id) => catLabel(id)).join(" · ") || (manifest.fallback ? "*" : "")}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        <DraftPreview draft={draft} />
      </div>
    </div>
  )
}

function SiteSource({ draft, update }: StepProps) {
  const { t } = useScreenkit()
  const zoom = Math.round((draft.source.zoom ?? 1) * 100)
  const setSource = (patch: Partial<WizardDraft["source"]>) => update({ source: { ...draft.source, ...patch } })
  return (
    <div className="flex flex-col gap-5">
      <StepIntro title={t("wizard.source.siteTitle")} desc={t("wizard.source.siteDesc")} />
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_260px]">
        <div className="flex flex-col gap-4">
          <Field label={t("kind.source.url")} required>
            <Input value={draft.source.url ?? ""} onChange={(event) => setSource({ url: event.target.value })} placeholder={t("kind.source.urlPh")} className={inputCls} inputMode="url" />
          </Field>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] lowercase text-text-secondary">{t("kind.source.zoom")}</span>
              <span className="font-mono text-xs text-text-secondary">{zoom}%</span>
            </div>
            <Slider value={[zoom]} min={25} max={300} step={5} onValueChange={(value) => setSource({ zoom: value[0] / 100 })} />
          </div>
          <Toggle title={t("kind.source.scroll")} desc={t("kind.source.scrollDesc")} checked={draft.source.scroll ?? false} onChange={(scroll) => setSource({ scroll })} />
          <Explain>{t("kind.site.blocked")}</Explain>
        </div>
        <DraftPreview draft={draft} />
      </div>
    </div>
  )
}

/* the encoded WriteFile message carries the path, the commit message and the
   grpc-web framing besides the bytes, and the whole message has to fit the
   router's readMaxBytes: reserve room for the envelope so a file just under
   the cap fails with the friendly toast instead of resource_exhausted */
const MAX_UPLOAD_BYTES = RPC_MAX_MESSAGE_BYTES - 64 * 1024

type FileTab = "cloud" | "url" | "upload"

function FileSource({ draft, update }: StepProps) {
  const { t } = useScreenkit()
  const [tab, setTab] = React.useState<FileTab>(draft.source.url && !draft.source.path ? "url" : "cloud")
  const [uploading, setUploading] = React.useState(false)
  const fileInput = React.useRef<HTMLInputElement | null>(null)
  const setSource = (patch: Partial<WizardDraft["source"]>) => update({ source: { ...draft.source, ...patch } })

  const pick = (entry: Entry) => setSource({ path: entry.path, url: undefined })

  const upload = async (file: File) => {
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error(t("wizard.file.uploadTooLarge"))
      return
    }
    setUploading(true)
    try {
      const content = new Uint8Array(await file.arrayBuffer())
      const folder = draft.slug.trim() || suggestSlug(draft.titleRu) || draft.date
      const path = `inserts/${folder}/${file.name}`
      await cloudClient().writeFile({ path, content, sha: "", message: `upload ${file.name} for insert ${folder}` })
      invalidateCloudTree()
      setSource({ path, url: undefined })
      toast.success(`${t("wizard.file.uploaded")} · ${formatBytes(file.size)}`)
      setTab("cloud")
    } catch (error) {
      toast.error(`${t("wizard.file.uploadFailed")}: ${rpcErrorMessage(error)}`)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <StepIntro title={t("wizard.source.fileTitle")} desc={t("wizard.source.fileDesc")} />
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_260px]">
        <div className="flex flex-col gap-4">
          <SegmentedControl<FileTab>
            options={[
              { value: "cloud", label: t("wizard.file.cloud") },
              { value: "url", label: t("wizard.file.url") },
              { value: "upload", label: t("wizard.file.upload") },
            ]}
            value={tab}
            onChange={setTab}
            size="sm"
          />
          {tab === "cloud" ? (
            /* its own boundary: the picker chunk must not suspend the dialog */
            <React.Suspense fallback={<PickerSkeleton label={t("wizard.file.loading")} />}>
              <FilePickerLazy value={draft.source.path} onPick={pick} />
            </React.Suspense>
          ) : null}
          {tab === "url" ? (
            <Field label={t("kind.source.url")} required>
              <Input value={draft.source.url ?? ""} onChange={(event) => setSource({ url: event.target.value, path: undefined })} placeholder={t("kind.source.urlPh")} className={inputCls} inputMode="url" />
            </Field>
          ) : null}
          {tab === "upload" ? (
            <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-panel-border p-4">
              <Explain>{t("wizard.file.uploadHint")}</Explain>
              <input
                ref={fileInput}
                type="file"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void upload(file)
                  event.target.value = ""
                }}
              />
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInput.current?.click()}
                className="inline-flex items-center gap-2 rounded-xl bg-control-active px-4 py-2.5 font-mono text-sm lowercase text-control-active-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                {uploading ? t("wizard.file.uploading") : t("wizard.file.choose")}
              </button>
            </div>
          ) : null}
          {draft.source.path ? (
            <p className="font-mono text-[11px] lowercase text-text-muted">
              {t("wizard.file.selected")}: <span className="text-foreground">{draft.source.path}</span>
            </p>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="font-mono text-[11px] lowercase text-text-secondary">{t("kind.source.fit")}</span>
              <SegmentedControl<"contain" | "cover">
                options={[
                  { value: "contain", label: t("player.settings.fit.contain") },
                  { value: "cover", label: t("player.settings.fit.cover") },
                ]}
                value={draft.source.fit ?? "contain"}
                onChange={(fit) => setSource({ fit })}
                size="sm"
              />
            </div>
            <Toggle title={t("kind.source.autoplay")} desc={t("kind.source.autoplayDesc")} checked={draft.source.autoplay ?? false} onChange={(autoplay) => setSource({ autoplay })} />
            <Toggle title={t("kind.source.loop")} desc={t("kind.source.loopDesc")} checked={draft.source.loop ?? false} onChange={(loop) => setSource({ loop })} />
            <Toggle title={t("kind.source.muted")} desc={t("kind.source.mutedDesc")} checked={draft.source.muted ?? false} onChange={(muted) => setSource({ muted })} />
          </div>
        </div>
        <DraftPreview draft={draft} />
      </div>
    </div>
  )
}

const FilePickerLazy = React.lazy(() => import("./file-picker").then((module) => ({ default: module.FilePicker })))

/** the shape of the picker while its chunk arrives */
function PickerSkeleton({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-3" aria-busy="true">
      <div className="h-10 rounded-xl border border-panel-border bg-control" />
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((index) => (
          <div key={index} className="h-6 w-16 rounded-full border border-panel-border bg-panel-soft" />
        ))}
      </div>
      <div className="flex h-64 items-center justify-center rounded-2xl border border-panel-border bg-control">
        <span className="inline-flex items-center gap-2 font-mono text-[11px] lowercase text-text-muted">
          <Loader2 className="size-3.5 animate-spin" /> {label}
        </span>
      </div>
    </div>
  )
}

/* ------------------------------ 3 · identity ------------------------------ */

export function IdentityStep({ draft, update }: StepProps) {
  const { t, categories, catLabel, contentLocale } = useScreenkit()
  const pickDevice = (device: DeviceType) => {
    const preset = DEVICES.find((item) => item.id === device)
    update({ device, aspect: preset?.aspect ?? draft.aspect })
  }
  return (
    <div className="flex flex-col gap-5">
      <StepIntro title={t("wizard.identity.title")} desc={t("wizard.identity.desc")} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("editor.titleRu")} required>
          <Input value={draft.titleRu} onChange={(event) => update({ titleRu: event.target.value })} placeholder={t("editor.titleRuPh")} className={inputCls} autoFocus />
        </Field>
        <Field label={t("editor.titleEn")} hint={t("editor.optional")}>
          <Input value={draft.titleEn} onChange={(event) => update({ titleEn: event.target.value })} placeholder={t("editor.titleEnPh")} className={inputCls} />
        </Field>
      </div>
      <Field label={t("editor.slug")} hint={t("editor.slugHint")}>
        <Input value={draft.slug} onChange={(event) => update({ slug: event.target.value })} placeholder={suggestSlug(draft.titleRu) || t("editor.slugPh")} className={inputCls} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label={t("library.category")}>
          <Select value={draft.category} onValueChange={(category) => update({ category })}>
            <SelectTrigger className={triggerCls}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category.id} value={String(category.id)} className="lowercase">
                  {catLabel(category.id)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={t("library.device")}>
          <Select value={draft.device} onValueChange={(value) => pickDevice(value as DeviceType)}>
            <SelectTrigger className={triggerCls}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DEVICES.map((device) => (
                <SelectItem key={device.id} value={device.id} className="lowercase">
                  {deviceLabel(device.id, contentLocale)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={t("editor.aspect")}>
          <Select value={draft.aspect} onValueChange={(value) => update({ aspect: value as AspectRatio })}>
            <SelectTrigger className={triggerCls}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ASPECTS.map((aspect) => (
                <SelectItem key={aspect} value={aspect} className="lowercase">
                  {aspect}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={t("library.status")}>
          <Select value={draft.status} onValueChange={(value) => update({ status: value as InsertStatus })}>
            <SelectTrigger className={triggerCls}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((status) => (
                <SelectItem key={status.id} value={status.id} className="lowercase">
                  {statusLabel(status.id, contentLocale)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t("editor.episode")}>
          <Input value={draft.episode} onChange={(event) => update({ episode: event.target.value })} className={inputCls} />
        </Field>
        <Field label={t("editor.scene")}>
          <Input value={draft.scene} onChange={(event) => update({ scene: event.target.value })} className={inputCls} />
        </Field>
        <Field label={t("editor.date")} required>
          <Input type="date" value={draft.date} onChange={(event) => update({ date: event.target.value })} className={inputCls} />
        </Field>
      </div>
    </div>
  )
}

/* ------------------------------ 4 · texts ------------------------------ */

type TextPair = { ru: keyof WizardDraft; en: keyof WizardDraft; labelRu: string; labelEn: string; rows: number }

export function TextsStep({ draft, update }: StepProps) {
  const { t } = useScreenkit()
  const groups: { key: string; pairs: TextPair[] }[] = [
    {
      key: "description",
      pairs: [{ ru: "descriptionRu", en: "descriptionEn", labelRu: t("editor.description"), labelEn: t("editor.descriptionEn"), rows: 3 }],
    },
    {
      key: "prompts",
      pairs: [
        { ru: "promptRu", en: "promptEn", labelRu: t("editor.prompt"), labelEn: t("editor.promptEn"), rows: 4 },
        { ru: "shortPromptRu", en: "shortPromptEn", labelRu: t("editor.shortPrompt"), labelEn: t("editor.shortPromptEn"), rows: 2 },
        { ru: "negativePromptRu", en: "negativePromptEn", labelRu: t("editor.negativePrompt"), labelEn: t("editor.negativePromptEn"), rows: 2 },
      ],
    },
    {
      key: "notes",
      pairs: [{ ru: "technicalNotesRu", en: "technicalNotesEn", labelRu: t("editor.technicalNotes"), labelEn: `${t("editor.technicalNotes")} (en)`, rows: 4 }],
    },
  ]
  return (
    <div className="flex flex-col gap-5">
      <StepIntro title={t("wizard.texts.title")} desc={t("wizard.texts.desc")} />
      {groups.map((group, index) => (
        <details key={group.key} open={index === 0} className="group rounded-2xl border border-panel-border bg-panel-soft">
          <summary className="cursor-pointer select-none px-4 py-3 font-mono text-sm lowercase text-foreground marker:text-text-faint">
            {t(`wizard.texts.group.${group.key}`)}
          </summary>
          <div className="flex flex-col gap-4 px-4 pb-4">
            {group.pairs.map((pair) => (
              <div key={pair.ru} className="grid gap-4 sm:grid-cols-2">
                <Field label={pair.labelRu} hint={t("editor.optional")}>
                  <Textarea value={String(draft[pair.ru])} onChange={(event) => update({ [pair.ru]: event.target.value } as Partial<WizardDraft>)} rows={pair.rows} className={areaCls} />
                </Field>
                <Field label={pair.labelEn} hint={t("editor.optional")}>
                  <Textarea value={String(draft[pair.en])} onChange={(event) => update({ [pair.en]: event.target.value } as Partial<WizardDraft>)} rows={pair.rows} className={areaCls} />
                </Field>
              </div>
            ))}
          </div>
        </details>
      ))}
    </div>
  )
}

/* ------------------------------ 5 · review ------------------------------ */

export function ReviewStep({ draft }: StepProps) {
  const { t, catLabel, contentLocale } = useScreenkit()
  const sceneLabel = sceneManifests.find((manifest) => manifest.key === draft.sceneKey)?.label
  return (
    <div className="flex flex-col gap-5">
      <StepIntro title={t("wizard.review.title")} desc={t("wizard.review.desc")} />
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_260px]">
        <div className="rounded-2xl border border-panel-border bg-panel-soft px-4 py-1">
          <KeyVal label={t("wizard.step.kind")} value={t(`kind.${draft.kind}`)} accent={KIND_ACCENT[draft.kind]} />
          {draft.kind === "scene" && sceneLabel ? <KeyVal label={t("wizard.scene.renders")} value={sceneLabel} /> : null}
          {draft.kind === "site" ? <KeyVal label={t("kind.source.url")} value={normalizeHttpUrl(draft.source.url)} /> : null}
          {draft.kind === "file" ? <KeyVal label={draft.source.path ? t("kind.source.path") : t("kind.source.url")} value={draft.source.path ?? draft.source.url ?? "—"} /> : null}
          <KeyVal label={t("editor.titleRu")} value={draft.titleRu || "—"} />
          {draft.titleEn ? <KeyVal label={t("editor.titleEn")} value={draft.titleEn} /> : null}
          <KeyVal label={t("editor.slug")} value={draft.slug || suggestSlug(draft.titleRu) || "—"} />
          <KeyVal label={t("library.category")} value={catLabel(draft.category)} />
          <KeyVal label={t("library.device")} value={`${deviceLabel(draft.device, contentLocale)} · ${draft.aspect}`} />
          <KeyVal label={t("library.status")} value={statusLabel(draft.status, contentLocale)} />
          <KeyVal label={t("editor.date")} value={`${draft.date} · ${draft.episode} · ${draft.scene}`} />
        </div>
        <DraftPreview draft={draft} />
      </div>
    </div>
  )
}
