"use client"

import { formatTime } from "@/lib/media/kinds"
import { PLAYBACK_RATES } from "@/lib/media/player-settings"
import { cn } from "@/lib/utils"
import {
  Download,
  Loader2,
  Maximize2,
  Minimize2,
  Pause,
  PictureInPicture2,
  Play,
  Repeat,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react"
import * as React from "react"
import { useScreenkit } from "../store"
import { usePlayerSettings } from "./player-settings"

/* ------------------------------------------------------------------ *
 * media player
 *
 * One player for video and audio, drawn in the design system instead of
 * the browser chrome: a seek bar with buffered ranges, time, volume, speed,
 * loop, picture-in-picture, fullscreen and download. `screen` mode drops
 * the controls so the same component can sit inside a device frame as a
 * file insert.
 * ------------------------------------------------------------------ */

export type MediaPlayerProps = {
  src: string
  kind: "video" | "audio"
  name?: string
  className?: string
  /** chromeless: no controls, fills the box — used inside device screens */
  screen?: boolean
  fit?: "contain" | "cover"
  background?: string
  autoplay?: boolean
  loop?: boolean
  muted?: boolean
  /** how the bytes arrive; shown in the stats overlay */
  via?: "url" | "rpc"
}

type Range = { start: number; end: number }

const noop = () => undefined

function readBuffered(media: HTMLMediaElement): Range[] {
  const out: Range[] = []
  try {
    for (let i = 0; i < media.buffered.length; i += 1) {
      out.push({ start: media.buffered.start(i), end: media.buffered.end(i) })
    }
  } catch {
    // buffered can throw while the element is being torn down
  }
  return out
}

function bufferedAhead(ranges: Range[], time: number): number {
  const range = ranges.find((r) => r.start <= time && time <= r.end)
  return range ? range.end - time : 0
}

export function MediaPlayer({
  src,
  kind,
  name,
  className,
  screen = false,
  fit = "contain",
  background = "#000",
  autoplay,
  loop,
  muted,
  via,
}: MediaPlayerProps) {
  const { t } = useScreenkit()
  const { settings, update } = usePlayerSettings()
  const mediaRef = React.useRef<HTMLVideoElement | HTMLAudioElement | null>(null)
  const boxRef = React.useRef<HTMLDivElement | null>(null)
  const startedRef = React.useRef(false)
  const hideTimer = React.useRef<number | null>(null)

  const wantAutoplay = autoplay ?? settings.autoplay
  const wantLoop = loop ?? settings.loop
  const wantMuted = muted ?? settings.muted

  const [playing, setPlaying] = React.useState(false)
  const [waiting, setWaiting] = React.useState(false)
  const [time, setTime] = React.useState(0)
  const [duration, setDuration] = React.useState(0)
  const [ranges, setRanges] = React.useState<Range[]>([])
  const [isMuted, setIsMuted] = React.useState(wantMuted)
  const [rate, setRate] = React.useState(settings.playbackRate)
  const [looping, setLooping] = React.useState(wantLoop)
  const [fullscreen, setFullscreen] = React.useState(false)
  const [pip, setPip] = React.useState(false)
  const [controls, setControls] = React.useState(true)
  const [resolution, setResolution] = React.useState<[number, number] | null>(null)
  const [dropped, setDropped] = React.useState<number | null>(null)
  const [readyState, setReadyState] = React.useState(0)

  /* ------------------------------ element events ------------------------------ */

  React.useEffect(() => {
    const media = mediaRef.current
    if (!media) return
    startedRef.current = false
    media.volume = settings.volume / 100
    media.muted = wantMuted
    media.playbackRate = settings.playbackRate
    media.loop = wantLoop
    setIsMuted(wantMuted)
    setLooping(wantLoop)
    setRate(settings.playbackRate)

    const tryStart = () => {
      if (!wantAutoplay || startedRef.current) return
      const ahead = bufferedAhead(readBuffered(media), media.currentTime)
      const remaining = Number.isFinite(media.duration) ? media.duration - media.currentTime : Infinity
      const enough = ahead >= Math.min(settings.bufferAhead, remaining) || media.readyState >= 4
      if (!enough) return
      startedRef.current = true
      media.play().catch(() => {
        // autoplay with sound is often refused: retry muted
        media.muted = true
        setIsMuted(true)
        media.play().catch(noop)
      })
    }

    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onTime = () => setTime(media.currentTime)
    const onDuration = () => setDuration(Number.isFinite(media.duration) ? media.duration : 0)
    const onProgress = () => {
      setRanges(readBuffered(media))
      setReadyState(media.readyState)
      tryStart()
    }
    const onWaiting = () => setWaiting(true)
    const onPlaying = () => {
      setWaiting(false)
      setReadyState(media.readyState)
    }
    const onCanPlay = () => {
      setWaiting(false)
      setReadyState(media.readyState)
      tryStart()
    }
    const onVolume = () => setIsMuted(media.muted)
    const onRate = () => setRate(media.playbackRate)
    const onMeta = () => {
      onDuration()
      if (media instanceof HTMLVideoElement) setResolution([media.videoWidth, media.videoHeight])
    }
    const onEnterPip = () => setPip(true)
    const onLeavePip = () => setPip(false)

    media.addEventListener("play", onPlay)
    media.addEventListener("pause", onPause)
    media.addEventListener("timeupdate", onTime)
    media.addEventListener("durationchange", onDuration)
    media.addEventListener("progress", onProgress)
    media.addEventListener("waiting", onWaiting)
    media.addEventListener("playing", onPlaying)
    media.addEventListener("canplay", onCanPlay)
    media.addEventListener("canplaythrough", onCanPlay)
    media.addEventListener("volumechange", onVolume)
    media.addEventListener("ratechange", onRate)
    media.addEventListener("loadedmetadata", onMeta)
    media.addEventListener("enterpictureinpicture", onEnterPip)
    media.addEventListener("leavepictureinpicture", onLeavePip)
    return () => {
      media.removeEventListener("play", onPlay)
      media.removeEventListener("pause", onPause)
      media.removeEventListener("timeupdate", onTime)
      media.removeEventListener("durationchange", onDuration)
      media.removeEventListener("progress", onProgress)
      media.removeEventListener("waiting", onWaiting)
      media.removeEventListener("playing", onPlaying)
      media.removeEventListener("canplay", onCanPlay)
      media.removeEventListener("canplaythrough", onCanPlay)
      media.removeEventListener("volumechange", onVolume)
      media.removeEventListener("ratechange", onRate)
      media.removeEventListener("loadedmetadata", onMeta)
      media.removeEventListener("enterpictureinpicture", onEnterPip)
      media.removeEventListener("leavepictureinpicture", onLeavePip)
    }
  }, [src, wantAutoplay, wantLoop, wantMuted, settings.bufferAhead, settings.playbackRate, settings.volume])

  /* stats: dropped frames are polled, there is no event for them */
  React.useEffect(() => {
    if (!settings.stats || kind !== "video") return
    const id = window.setInterval(() => {
      const media = mediaRef.current
      if (media instanceof HTMLVideoElement && typeof media.getVideoPlaybackQuality === "function") {
        setDropped(media.getVideoPlaybackQuality().droppedVideoFrames)
      }
    }, 1000)
    return () => window.clearInterval(id)
  }, [settings.stats, kind])

  React.useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === boxRef.current)
    document.addEventListener("fullscreenchange", onChange)
    return () => document.removeEventListener("fullscreenchange", onChange)
  }, [])

  /* ------------------------------ actions ------------------------------ */

  const toggle = React.useCallback(() => {
    const media = mediaRef.current
    if (!media) return
    if (media.paused) media.play().catch(noop)
    else media.pause()
  }, [])

  const seekBy = React.useCallback((delta: number) => {
    const media = mediaRef.current
    if (!media) return
    const max = Number.isFinite(media.duration) ? media.duration : Infinity
    media.currentTime = Math.max(0, Math.min(max, media.currentTime + delta))
  }, [])

  const seekTo = React.useCallback((next: number) => {
    const media = mediaRef.current
    if (!media) return
    media.currentTime = next
    setTime(next)
  }, [])

  const toggleMute = React.useCallback(() => {
    const media = mediaRef.current
    if (!media) return
    media.muted = !media.muted
  }, [])

  const setVolume = React.useCallback(
    (value: number) => {
      const media = mediaRef.current
      if (!media) return
      media.volume = value / 100
      if (value > 0 && media.muted) media.muted = false
      update({ volume: value })
    },
    [update],
  )

  const cycleRate = React.useCallback(() => {
    const media = mediaRef.current
    if (!media) return
    const index = PLAYBACK_RATES.indexOf(media.playbackRate as (typeof PLAYBACK_RATES)[number])
    const next = PLAYBACK_RATES[(index + 1) % PLAYBACK_RATES.length]
    media.playbackRate = next
  }, [])

  const toggleLoop = React.useCallback(() => {
    const media = mediaRef.current
    if (!media) return
    media.loop = !media.loop
    setLooping(media.loop)
  }, [])

  const toggleFullscreen = React.useCallback(() => {
    const box = boxRef.current
    if (!box) return
    if (document.fullscreenElement === box) document.exitFullscreen().catch(noop)
    else box.requestFullscreen?.().catch(noop)
  }, [])

  const togglePip = React.useCallback(() => {
    const media = mediaRef.current
    if (!(media instanceof HTMLVideoElement)) return
    if (document.pictureInPictureElement === media) document.exitPictureInPicture().catch(noop)
    else media.requestPictureInPicture?.().catch(noop)
  }, [])

  const showControls = React.useCallback(() => {
    setControls(true)
    if (hideTimer.current) window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => setControls(false), 2400)
  }, [])

  React.useEffect(
    () => () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current)
    },
    [],
  )

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!settings.hotkeys) return
    const media = mediaRef.current
    if (!media) return
    switch (event.key) {
      case " ":
      case "k":
      case "K":
        event.preventDefault()
        toggle()
        break
      case "ArrowLeft":
        event.preventDefault()
        seekBy(-5)
        break
      case "ArrowRight":
        event.preventDefault()
        seekBy(5)
        break
      case "j":
      case "J":
        seekBy(-10)
        break
      case "l":
      case "L":
        seekBy(10)
        break
      case "m":
      case "M":
        toggleMute()
        break
      case "f":
      case "F":
        if (kind === "video") toggleFullscreen()
        break
      case "ArrowUp":
        event.preventDefault()
        setVolume(Math.min(100, Math.round(media.volume * 100) + 5))
        break
      case "ArrowDown":
        event.preventDefault()
        setVolume(Math.max(0, Math.round(media.volume * 100) - 5))
        break
      default:
        return
    }
    showControls()
  }

  const hideBar = kind === "video" && playing && !controls && !screen
  const volumeIcon = isMuted || settings.volume === 0 ? VolumeX : settings.volume < 50 ? Volume1 : Volume2
  const VolumeIcon = volumeIcon
  const pipSupported = kind === "video" && typeof document !== "undefined" && "pictureInPictureEnabled" in document && document.pictureInPictureEnabled

  const element =
    kind === "video" ? (
      <video
        ref={mediaRef as React.RefObject<HTMLVideoElement>}
        src={src}
        preload={settings.preload}
        playsInline
        loop={wantLoop}
        muted={wantMuted}
        onClick={screen ? toggle : undefined}
        className={cn("block h-full w-full", fit === "cover" ? "object-cover" : "object-contain")}
        style={{ background }}
      />
    ) : (
      <audio ref={mediaRef as React.RefObject<HTMLAudioElement>} src={src} preload={settings.preload} loop={wantLoop} muted={wantMuted} />
    )

  if (screen) {
    return (
      <div ref={boxRef} className={cn("relative h-full w-full overflow-hidden", className)} style={{ background }}>
        {kind === "video" ? (
          element
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 font-mono text-white/80">
            {element}
            <button type="button" onClick={toggle} className="rounded-full border border-white/20 p-4" aria-label={playing ? t("player.pause") : t("player.play")}>
              {playing ? <Pause className="size-6" /> : <Play className="size-6" />}
            </button>
            <span className="text-[11px] lowercase">{name}</span>
            <span className="text-[11px] tabular-nums">{formatTime(time)} / {formatTime(duration)}</span>
          </div>
        )}
        {waiting ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <Loader2 className="size-6 animate-spin text-white/80" />
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div
      ref={boxRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerMove={showControls}
      onPointerLeave={() => playing && setControls(false)}
      className={cn(
        "group relative flex w-full flex-col overflow-hidden rounded-2xl border border-panel-border bg-black outline-none focus-visible:ring-2 focus-visible:ring-ring",
        kind === "audio" && "bg-panel-soft",
        className,
      )}
      style={kind === "video" ? { background } : undefined}
    >
      {kind === "video" ? (
        <div className="relative aspect-video w-full" onClick={toggle} onDoubleClick={toggleFullscreen}>
          {element}
          {waiting ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30">
              <span className="inline-flex items-center gap-2 rounded-full bg-panel/80 px-3 py-1.5 font-mono text-[11px] lowercase text-foreground backdrop-blur">
                <Loader2 className="size-3.5 animate-spin" /> {t("player.buffering")}
              </span>
            </div>
          ) : null}
          {settings.stats ? (
            <dl className="pointer-events-none absolute left-2 top-2 grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5 rounded-xl bg-panel/85 px-3 py-2 font-mono text-[10px] lowercase text-text-secondary backdrop-blur">
              <dt className="text-text-faint">{t("player.stats.resolution")}</dt>
              <dd>{resolution ? `${resolution[0]}×${resolution[1]}` : "—"}</dd>
              <dt className="text-text-faint">{t("player.stats.buffered")}</dt>
              <dd>{bufferedAhead(ranges, time).toFixed(1)} s</dd>
              <dt className="text-text-faint">{t("player.stats.dropped")}</dt>
              <dd>{dropped ?? "—"}</dd>
              <dt className="text-text-faint">{t("player.stats.rate")}</dt>
              <dd>{rate}×</dd>
              <dt className="text-text-faint">{t("player.stats.state")}</dt>
              <dd>{readyState}/4</dd>
              <dt className="text-text-faint">{t("player.stats.source")}</dt>
              <dd>{via === "url" ? t("player.source.url") : via === "rpc" ? t("player.source.rpc") : "—"}</dd>
            </dl>
          ) : null}
        </div>
      ) : (
        <div className="flex items-center gap-3 px-4 pt-4">
          {element}
          <span className="min-w-0 flex-1 truncate font-mono text-sm lowercase text-foreground">{name}</span>
        </div>
      )}

      <div
        className={cn(
          "flex flex-col gap-2 px-3 pb-3 pt-2 transition-opacity duration-300",
          kind === "video" && "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent",
          hideBar && "opacity-0",
        )}
      >
        <SeekBar time={time} duration={duration} ranges={ranges} onSeek={seekTo} label={t("player.seek")} />
        <div className="flex flex-wrap items-center gap-1">
          <Ctl label={playing ? t("player.pause") : t("player.play")} onClick={toggle}>
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          </Ctl>
          <span className="px-1 font-mono text-[11px] tabular-nums text-white/85">
            {formatTime(time)} <span className="text-white/45">/ {formatTime(duration)}</span>
          </span>
          <div className="ml-auto flex items-center gap-1">
            <Ctl label={isMuted ? t("player.unmute") : t("player.mute")} onClick={toggleMute}>
              <VolumeIcon className="size-4" />
            </Ctl>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={isMuted ? 0 : settings.volume}
              onChange={(event) => setVolume(Number(event.target.value))}
              aria-label={t("player.volume")}
              className="hidden h-1 w-20 cursor-ew-resize accent-white sm:block"
            />
            <Ctl label={t("player.speed")} onClick={cycleRate} text>
              {rate}×
            </Ctl>
            <Ctl label={t("player.loop")} onClick={toggleLoop} active={looping}>
              <Repeat className="size-4" />
            </Ctl>
            {pipSupported ? (
              <Ctl label={t("player.pip")} onClick={togglePip} active={pip}>
                <PictureInPicture2 className="size-4" />
              </Ctl>
            ) : null}
            <a
              href={src}
              download={name ?? true}
              aria-label={t("player.download")}
              title={t("player.download")}
              className="inline-flex size-8 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              <Download className="size-4" />
            </a>
            {kind === "video" ? (
              <Ctl label={fullscreen ? t("player.exitFullscreen") : t("player.fullscreen")} onClick={toggleFullscreen}>
                {fullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
              </Ctl>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

function Ctl({
  label,
  onClick,
  active,
  text,
  children,
}: {
  label: string
  onClick: () => void
  active?: boolean
  text?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 items-center justify-center rounded-full font-mono text-[11px] lowercase transition-colors hover:bg-white/10 hover:text-white",
        text ? "min-w-10 px-2 tabular-nums" : "w-8",
        active ? "text-accent-cyan" : "text-white/80",
      )}
    >
      {children}
    </button>
  )
}

function SeekBar({
  time,
  duration,
  ranges,
  onSeek,
  label,
}: {
  time: number
  duration: number
  ranges: Range[]
  onSeek: (next: number) => void
  label: string
}) {
  const barRef = React.useRef<HTMLDivElement | null>(null)
  const [hover, setHover] = React.useState<number | null>(null)
  const ratio = duration > 0 ? Math.min(1, time / duration) : 0

  const timeAt = (clientX: number) => {
    const bar = barRef.current
    if (!bar || duration <= 0) return 0
    const rect = bar.getBoundingClientRect()
    const x = Math.min(rect.width, Math.max(0, clientX - rect.left))
    return (x / rect.width) * duration
  }

  return (
    <div
      ref={barRef}
      role="slider"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(time)}
      aria-valuetext={formatTime(time)}
      tabIndex={-1}
      onPointerDown={(event) => {
        event.stopPropagation()
        event.currentTarget.setPointerCapture(event.pointerId)
        onSeek(timeAt(event.clientX))
      }}
      onPointerMove={(event) => {
        setHover(timeAt(event.clientX))
        if (event.buttons === 1) onSeek(timeAt(event.clientX))
      }}
      onPointerLeave={() => setHover(null)}
      onClick={(event) => event.stopPropagation()}
      className="group/seek relative h-4 w-full cursor-pointer touch-none"
    >
      <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-white/20 transition-[height] group-hover/seek:h-1.5">
        {duration > 0
          ? ranges.map((range, index) => (
              <span
                key={index}
                className="absolute inset-y-0 bg-white/30"
                style={{ left: `${(range.start / duration) * 100}%`, width: `${((range.end - range.start) / duration) * 100}%` }}
              />
            ))
          : null}
        <span className="absolute inset-y-0 left-0 bg-accent-cyan" style={{ width: `${ratio * 100}%` }} />
      </div>
      <span
        className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow opacity-0 transition-opacity group-hover/seek:opacity-100"
        style={{ left: `${ratio * 100}%` }}
      />
      {hover !== null && duration > 0 ? (
        <span
          className="pointer-events-none absolute -top-6 -translate-x-1/2 rounded-md bg-panel px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-foreground"
          style={{ left: `${(hover / duration) * 100}%` }}
        >
          {formatTime(hover)}
        </span>
      ) : null}
    </div>
  )
}
