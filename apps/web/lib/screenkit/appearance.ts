/* ------------------------------------------------------------------ *
 * appearance: the values that must be on <html> before the first paint
 *
 * Palette, gradients, site scale, glass and the narrow-screen rail are all
 * stored per browser and applied as `<html>` attributes / custom properties.
 * Their providers can only do that in an effect, i.e. after hydration, so the
 * server-rendered markup would paint with the defaults and then jump: opaque
 * surfaces turning translucent, the root font-size going 100% -> 108%, a rail
 * the user had hidden sliding away.
 *
 * `APPEARANCE_BOOT_SCRIPT` is the small blocking script that closes that gap
 * (see `app/layout.tsx`). It is a plain string, so this module must stay free
 * of "use client" and of react: `app/layout.tsx` is a server component and
 * would otherwise receive client references instead of values. The providers
 * import the same keys and defaults from here, and `appearance.test.ts` runs
 * the script against the same helpers the providers use, so the two cannot
 * drift apart silently.
 * ------------------------------------------------------------------ */

import {
  DEFAULT_GLASS,
  GLASS_BOUNDS,
  GLASS_GLOW_COLORS,
  GLASS_KEY,
  GLASS_NOISE_IMAGE,
  GLASS_TARGET_KEYS,
  GLOW_COLOR_VALUE,
  LEGACY_GLOW_KEY,
} from "./glass"

export const PALETTES = ["cobalt", "sunset", "forest", "mono"] as const
export type Palette = (typeof PALETTES)[number]

/* gradient intensity — user-personalisable, applied to accent surfaces
   (category tiles / icons / active accents). minimal by default. */
export const GRADIENT_LEVELS = ["off", "soft", "vivid"] as const
export type GradientLevel = (typeof GRADIENT_LEVELS)[number]

/* site scale / zoom — scales the root font-size so every rem-based size and
   spacing token grows or shrinks together. defaults a touch larger than 1. */
export const SCALE_LEVELS = ["compact", "normal", "large", "huge"] as const
export type ScaleLevel = (typeof SCALE_LEVELS)[number]
export const SCALE_VALUE: Record<ScaleLevel, number> = {
  compact: 0.92,
  normal: 1,
  large: 1.08,
  huge: 1.2,
}

export const PALETTE_KEY = "screenkit-palette"
export const GRADIENT_KEY = "screenkit-gradients"
export const SCALE_KEY = "screenkit-scale"
/** narrow-screen rail placement and visibility, owned by components/screenkit/layout.tsx */
export const RAIL_LAYOUT_KEY = "screenkit-layout-v1"

export const DEFAULT_PALETTE: Palette = "cobalt"
export const DEFAULT_GRADIENTS: GradientLevel = "soft"
/** keep in step with `--app-scale` in globals.css, which is the no-javascript fallback */
export const DEFAULT_SCALE: ScaleLevel = "large"

/** everything the boot script needs, serialised into it at build time */
const BOOT_CONFIG = {
  paletteKey: PALETTE_KEY,
  gradientKey: GRADIENT_KEY,
  scaleKey: SCALE_KEY,
  railKey: RAIL_LAYOUT_KEY,
  glassKey: GLASS_KEY,
  legacyGlowKey: LEGACY_GLOW_KEY,
  palettes: PALETTES,
  gradients: GRADIENT_LEVELS,
  scales: SCALE_LEVELS,
  scaleValue: SCALE_VALUE,
  defaults: {
    palette: DEFAULT_PALETTE,
    gradients: DEFAULT_GRADIENTS,
    scale: DEFAULT_SCALE,
  },
  glass: DEFAULT_GLASS,
  bounds: GLASS_BOUNDS,
  glowColors: GLOW_COLOR_VALUE,
  glowColorKeys: GLASS_GLOW_COLORS,
  targetKeys: GLASS_TARGET_KEYS,
  noiseImage: GLASS_NOISE_IMAGE,
}

/* `<` never reaches the document as markup: the noise image is an inline svg
   data url, and an unescaped "</…" inside a <script> would end the element. */
const config = JSON.stringify(BOOT_CONFIG).replace(/</g, "\\u003c")

/**
 * Mirrors `applyGlassToDocument` (lib/screenkit/glass.ts), the palette/scale
 * writes in `PaletteProvider` and the rail state in `LayoutProvider`, in ES5
 * that can run before any bundle. Failures are swallowed on purpose: a
 * private-mode localStorage must not stop the page from rendering, it only
 * costs the flash this script is here to prevent.
 */
export const APPEARANCE_BOOT_SCRIPT = `(function(w){try{
var d=w.document,e=d.documentElement,st=e.style,C=${config};
var read=function(k){try{return w.localStorage.getItem(k)}catch(_){return null}};
var one=function(v,list,fb){return list.indexOf(v)>-1?v:fb};
var json=function(k){var r=read(k);if(!r)return null;try{var p=JSON.parse(r);return p&&typeof p==="object"?p:null}catch(_){return null}};
e.setAttribute("data-palette",one(read(C.paletteKey),C.palettes,C.defaults.palette));
e.setAttribute("data-gradients",one(read(C.gradientKey),C.gradients,C.defaults.gradients));
st.setProperty("--app-scale",String(C.scaleValue[one(read(C.scaleKey),C.scales,C.defaults.scale)]));
var g=C.glass,raw=read(C.glassKey),s=json(C.glassKey);
if(!s)s=raw?{}:read(C.legacyGlowKey)==="on"?{enabled:true}:read(C.legacyGlowKey)==="off"?{enabled:false}:{};
var bool=function(v,fb){return typeof v==="boolean"?v:fb};
var num=function(k){var v=s[k],b=C.bounds[k];return typeof v==="number"&&isFinite(v)?Math.min(b[1],Math.max(b[0],v)):g[k]};
e.setAttribute("data-glass",bool(s.enabled,g.enabled)?"on":"off");
var t=s.targets&&typeof s.targets==="object"?s.targets:{};
for(var i=C.targetKeys.length;i--;){var k=C.targetKeys[i];e.setAttribute("data-glass-"+k,bool(t[k],g.targets[k])?"on":"off")}
st.setProperty("--glass-blur",num("blur")+"px");
st.setProperty("--glass-alpha",String(num("alpha")));
st.setProperty("--glass-saturate",String(num("saturate")));
st.setProperty("--glass-border-glow",String(num("borderGlow")));
st.setProperty("--glass-glow-color",C.glowColors[one(s.glowColor,C.glowColorKeys,g.glowColor)]);
var n=bool(s.noise,g.noise);
st.setProperty("--glass-noise",n?"1":"0");
st.setProperty("--glass-noise-image",n?C.noiseImage:"none");
var l=json(C.railKey);
if(l&&l.railVisible===false)e.setAttribute("data-rail","hidden");
}catch(_){}})(window)`
