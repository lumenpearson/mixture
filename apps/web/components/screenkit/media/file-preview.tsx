"use client"

import {
  TEXT_ENCODINGS,
  accentForKind,
  decodeText,
  formatBytes,
  guessEncoding,
  isTextEncoding,
  isTextual,
  looksBinary,
  mediaKindOf,
  type MediaKind,
  type TextEncoding,
} from "@/lib/media/kinds"
import { canOpenInNewTab, isActiveContentType } from "@/lib/media/url"
import { cn } from "@/lib/utils"
import {
  Archive,
  Download,
  ExternalLink,
  File as FileIcon,
  FileCode2,
  FileText,
  Image as ImageIcon,
  Loader2,
  Music,
  Type,
  Video,
  WrapText,
  ZoomIn,
} from "lucide-react"
import * as React from "react"
import { useScreenkit } from "../store"
import { MediaPlayer } from "./player"
import { usePlayerSettings } from "./player-settings"
import { useMediaLoad, type MediaSource } from "./use-media-load"

/* ------------------------------------------------------------------ *
 * file preview
 *
 * Shows any file the drive can hold: images with zoom and fit, video and
 * audio through the media player, pdf in a frame, text and code decoded in
 * a chosen encoding, and an information card for everything else. `panel`
 * mode adds a toolbar; `screen` mode is chromeless for device frames.
 * ------------------------------------------------------------------ */

export type FilePreviewProps = {
  source: MediaSource
  name: string
  contentType?: string
  size?: number
  mode?: "panel" | "screen"
  fit?: "contain" | "cover"
  zoom?: number
  autoplay?: boolean
  loop?: boolean
  muted?: boolean
  background?: string
  className?: string
}

type IconComponent = React.ComponentType<{ className?: string }>

/** the lucide glyph for a media kind (also used by the wizard and menus) */
export const KIND_ICONS: Record<MediaKind, IconComponent> = {
  image: ImageIcon,
  video: Video,
  audio: Music,
  pdf: FileText,
  text: FileText,
  markdown: FileText,
  code: FileCode2,
  archive: Archive,
  font: Type,
  folder: FileIcon,
  other: FileIcon,
}

export const iconForKind = (kind: MediaKind): IconComponent => KIND_ICONS[kind]

export function FilePreview({
  source,
  name,
  contentType,
  size,
  mode = "panel",
  fit,
  zoom,
  autoplay,
  loop,
  muted,
  background = "#000",
  className,
}: FilePreviewProps) {
  const { t } = useScreenkit()
  const { settings } = usePlayerSettings()
  const kind = mediaKindOf(name, contentType)
  const textual = isTextual(kind)
  const load = useMediaLoad(source, { wantBytes: textual })
  const screen = mode === "screen"

  if (load.status === "idle" || load.status === "loading") {
    return (
      <Shell screen={screen} className={className} background={background}>
        <span className="inline-flex items-center gap-2 font-mono text-[12px] lowercase text-text-muted">
          <Loader2 className="size-4 animate-spin" /> {t("player.preview.loading")}
        </span>
      </Shell>
    )
  }

  if (load.status === "error") {
    const text =
      load.reason === "too-large"
        ? t("player.preview.tooLarge")
        : load.reason === "missing"
          ? t("player.preview.missing")
          : `${t("player.preview.error")}${load.message ? ` — ${load.message}` : ""}`
    return (
      <Shell screen={screen} className={className} background={background}>
        <p className="max-w-sm text-center font-mono text-[12px] leading-relaxed text-text-muted">{text}</p>
      </Shell>
    )
  }

  const ready = load
  const effectiveFit = fit ?? settings.imageFit

  if (kind === "image") {
    return (
      <ImagePreview
        url={ready.url}
        contentType={ready.contentType}
        name={name}
        screen={screen}
        fit={effectiveFit}
        zoom={zoom}
        background={background}
        className={className}
      />
    )
  }

  if (kind === "video" || kind === "audio") {
    return (
      <MediaPlayer
        src={ready.url}
        kind={kind}
        name={name}
        screen={screen}
        fit={effectiveFit}
        background={background}
        autoplay={autoplay}
        loop={loop}
        muted={muted}
        via={ready.via}
        className={className}
      />
    )
  }

  // the frame renders whatever the bytes turn out to be, not what the file
  // name promised: an active document never gets a frame, only a download
  if (kind === "pdf" && !isActiveContentType(ready.contentType)) {
    return (
      <div className={cn("flex flex-col gap-2", screen ? "h-full w-full" : "", className)}>
        {!screen ? (
          <Toolbar>
            {canOpenInNewTab(ready.url, ready.contentType) ? (
              <ToolLink href={ready.url} label={t("player.preview.open")} icon={ExternalLink} />
            ) : null}
            <ToolLink href={ready.url} download={name} label={t("player.preview.download")} icon={Download} />
          </Toolbar>
        ) : null}
        {/* sandboxed like the site insert (kinds/site-screen.tsx), so a url
            that answers with html instead of a pdf cannot take the top frame
            or post a form. Our own bytes arrive as a blob of this origin and
            need `allow-same-origin` to load at all; a foreign url is framed
            with an opaque origin, where its scripts see nothing of ours.
            `allow-scripts` stays in both: the built-in pdf viewers are
            script-driven and a frame without it stays blank */}
        <iframe
          src={ready.url}
          title={name}
          sandbox={ready.via === "rpc" ? "allow-scripts allow-same-origin" : "allow-scripts allow-popups"}
          referrerPolicy="no-referrer"
          className={cn("w-full border-0 bg-white", screen ? "h-full" : "h-[70vh] rounded-2xl border border-panel-border")}
        />
      </div>
    )
  }

  if (textual && ready.bytes) {
    return <TextPreview bytes={ready.bytes} name={name} kind={kind} screen={screen} url={ready.url} className={className} />
  }

  const Icon = KIND_ICONS[kind]
  return (
    <Shell screen={screen} className={className} background={screen ? background : undefined}>
      <div className="flex flex-col items-center gap-3 text-center">
        <span
          className="flex size-14 items-center justify-center rounded-2xl border border-panel-border bg-panel-soft"
          style={{ color: accentForKind(kind) }}
        >
          <Icon className="size-6" />
        </span>
        <span className="max-w-xs truncate font-mono text-sm lowercase text-foreground">{name}</span>
        <span className="font-mono text-[11px] text-text-faint">
          {contentType || "—"} · {formatBytes(size ?? ready.size)}
        </span>
        <span className="font-mono text-[12px] text-text-muted">{t("player.preview.unsupported")}</span>
        {!screen ? (
          <a
            href={ready.url}
            download={name}
            className="inline-flex items-center gap-2 rounded-xl border border-panel-border bg-control px-3 py-2 font-mono text-xs lowercase text-foreground transition-colors hover:bg-panel-hover"
          >
            <Download className="size-3.5" /> {t("player.preview.download")}
          </a>
        ) : null}
      </div>
    </Shell>
  )
}

/* ------------------------------ image ------------------------------ */

function ImagePreview({
  url,
  contentType,
  name,
  screen,
  fit,
  zoom,
  background,
  className,
}: {
  url: string
  contentType?: string
  name: string
  screen: boolean
  fit: "contain" | "cover"
  zoom?: number
  background: string
  className?: string
}) {
  const { t } = useScreenkit()
  const [localZoom, setLocalZoom] = React.useState(100)
  // null until the toolbar button is used, so a change of the global image fit
  // in the style section still reaches an open preview
  const [localFit, setLocalFit] = React.useState<"contain" | "cover" | null>(null)
  const scale = screen ? (zoom ?? 1) : localZoom / 100
  const objectFit = screen ? fit : (localFit ?? fit)

  if (screen) {
    return (
      <div className={cn("flex h-full w-full items-center justify-center overflow-hidden", className)} style={{ background }}>
        <img
          src={url}
          alt={name}
          draggable={false}
          className={cn("h-full w-full", objectFit === "cover" ? "object-cover" : "object-contain")}
          style={{ transform: `scale(${scale})`, transformOrigin: "center" }}
        />
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Toolbar>
        <span className="inline-flex items-center gap-2 font-mono text-[11px] lowercase text-text-faint">
          <ZoomIn className="size-3.5" /> {t("player.preview.zoom")}
        </span>
        <input
          type="range"
          min={25}
          max={400}
          step={5}
          value={localZoom}
          onChange={(event) => setLocalZoom(Number(event.target.value))}
          aria-label={t("player.preview.zoom")}
          className="h-1 w-28 cursor-ew-resize accent-[var(--accent-cyan)]"
        />
        <span className="w-10 font-mono text-[11px] tabular-nums text-text-secondary">{localZoom}%</span>
        <button
          type="button"
          onClick={() => setLocalFit(objectFit === "cover" ? "contain" : "cover")}
          className="rounded-full border border-panel-border bg-control px-2.5 py-1 font-mono text-[11px] lowercase text-text-secondary transition-colors hover:bg-panel-hover hover:text-foreground"
        >
          {t("player.preview.fit")}: {objectFit === "cover" ? t("player.settings.fit.cover") : t("player.settings.fit.contain")}
        </button>
        <span className="ml-auto flex items-center gap-1">
          {/* an uploaded svg opened at a blob: url would run on this origin */}
          {canOpenInNewTab(url, contentType) ? <ToolLink href={url} label={t("player.preview.open")} icon={ExternalLink} /> : null}
          <ToolLink href={url} download={name} label={t("player.preview.download")} icon={Download} />
        </span>
      </Toolbar>
      {/* a fixed box: the picture arrives late and must not move the panel */}
      <div className="sk-scroll flex h-[60vh] items-center justify-center overflow-auto rounded-2xl border border-panel-border bg-black/90 p-2">
        <img
          src={url}
          alt={name}
          draggable={false}
          className={cn("max-h-full max-w-full transition-transform", objectFit === "cover" ? "object-cover" : "object-contain")}
          style={{ transform: `scale(${scale})`, transformOrigin: "center" }}
        />
      </div>
    </div>
  )
}

/* ------------------------------ text ------------------------------ */

function TextPreview({
  bytes,
  name,
  kind,
  screen,
  url,
  className,
}: {
  bytes: Uint8Array
  name: string
  kind: MediaKind
  screen: boolean
  url: string
  className?: string
}) {
  const { t } = useScreenkit()
  const { settings } = usePlayerSettings()
  const [override, setOverride] = React.useState<TextEncoding | null>(null)
  const [wrap, setWrap] = React.useState(kind !== "code")
  const [forceText, setForceText] = React.useState(false)
  const binary = React.useMemo(() => looksBinary(bytes), [bytes])
  const encoding: TextEncoding = override ?? (settings.encoding === "auto" ? guessEncoding(bytes) : settings.encoding)
  const text = React.useMemo(() => decodeText(bytes, encoding), [bytes, encoding])
  const lines = React.useMemo(() => text.split("\n"), [text])

  if (binary && !forceText) {
    return (
      <Shell screen={screen} className={className}>
        <button
          type="button"
          onClick={() => setForceText(true)}
          className="rounded-xl border border-panel-border bg-control px-3 py-2 font-mono text-xs lowercase text-text-secondary transition-colors hover:bg-panel-hover hover:text-foreground"
        >
          {t("player.preview.binary")}
        </button>
      </Shell>
    )
  }

  const body = (
    <pre
      className={cn(
        "sk-scroll font-mono text-[12px] leading-relaxed text-text-secondary",
        wrap ? "whitespace-pre-wrap [overflow-wrap:anywhere]" : "whitespace-pre",
        screen ? "h-full w-full overflow-auto bg-black p-3 text-white/85" : "max-h-[70vh] overflow-auto rounded-2xl border border-panel-border bg-panel-soft p-4",
      )}
    >
      {kind === "code"
        ? lines.map((line, index) => (
            <span key={index} className="block">
              <span className="mr-3 inline-block w-8 select-none text-right text-text-faint">{index + 1}</span>
              {line}
            </span>
          ))
        : text}
    </pre>
  )

  if (screen) return body

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Toolbar>
        <label className="inline-flex items-center gap-2 font-mono text-[11px] lowercase text-text-faint">
          {t("player.preview.encoding")}
          <select
            value={encoding}
            onChange={(event) => {
              const next = event.target.value
              if (isTextEncoding(next)) setOverride(next)
            }}
            className="h-7 rounded-lg border border-panel-border bg-control px-2 font-mono text-[11px] text-foreground"
          >
            {TEXT_ENCODINGS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => setWrap((current) => !current)}
          aria-pressed={wrap}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border border-panel-border px-2.5 py-1 font-mono text-[11px] lowercase transition-colors",
            wrap ? "bg-control-active text-control-active-foreground" : "bg-control text-text-secondary hover:bg-panel-hover hover:text-foreground",
          )}
        >
          <WrapText className="size-3.5" /> {t("player.preview.wrap")}
        </button>
        <span className="font-mono text-[11px] text-text-faint">
          {lines.length} {t("player.preview.lines")} · {formatBytes(bytes.byteLength)}
        </span>
        <span className="ml-auto flex items-center gap-1">
          <ToolLink href={url} download={name} label={t("player.preview.download")} icon={Download} />
        </span>
      </Toolbar>
      {body}
    </div>
  )
}

/* ------------------------------ bits ------------------------------ */

function Shell({
  screen,
  className,
  background,
  children,
}: {
  screen: boolean
  className?: string
  background?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center",
        screen ? "h-full w-full" : "min-h-40 rounded-2xl border border-dashed border-panel-border p-6",
        className,
      )}
      style={background ? { background } : undefined}
    >
      {children}
    </div>
  )
}

function Toolbar({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-panel-border bg-control px-3 py-2">{children}</div>
}

/*
 * Types a top-level navigation would *run* instead of display. A blob url is
 * same-origin by construction, so opening one in a tab puts the file on the
 * app's own origin, next to `mixture-cloud-token` in localStorage: an uploaded
 * `logo.svg` with a <script> inside would execute there. `/api/cloud/stream`
 * already neutralises the same list on its way out.
 */
const ACTIVE_TYPES = new Set([
  "image/svg+xml",
  "text/html",
  "application/xhtml+xml",
  "text/xml",
  "application/xml",
])


/**
 * "open in a new tab". A remote https url belongs to someone else's origin and
 * opens as it is; a same-origin blob url of an active type is handed over as a
 * download instead, so the file still leaves the app but nothing of it is
 * parsed as a document on our origin.
 */
function ToolLink({
  href,
  download,
  label,
  icon: Icon,
}: {
  href: string
  download?: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <a
      href={href}
      download={download}
      target={download ? undefined : "_blank"}
      rel={download ? undefined : "noreferrer"}
      aria-label={label}
      title={label}
      className="inline-flex size-8 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-panel-hover hover:text-foreground"
    >
      <Icon className="size-4" />
    </a>
  )
}
