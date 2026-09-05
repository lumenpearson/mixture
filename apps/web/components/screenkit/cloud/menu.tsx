"use client"

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { cn } from "@/lib/utils"
import { Check } from "lucide-react"
import * as React from "react"

/* ------------------------------------------------------------------ *
 * the file manager's context menu, dressed in the screenkit language
 *
 * Radix does the hard parts (portal, collision, roving focus, typeahead,
 * dismissal). These wrappers only restate the surface: monospace, lowercase,
 * rounded-2xl, panel borders and a translucent popover.
 * ------------------------------------------------------------------ */

const contentCls =
  "min-w-[13rem] rounded-2xl border border-panel-border bg-popover/95 p-1.5 font-mono text-xs lowercase text-popover-foreground shadow-xl backdrop-blur-md supports-[backdrop-filter]:bg-popover/80"

const itemCls =
  "flex cursor-default items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs lowercase outline-hidden transition-colors focus:bg-panel-hover focus:text-foreground data-disabled:pointer-events-none data-disabled:opacity-40 [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:text-text-faint focus:[&_svg]:text-foreground"

export function FmMenuContent({ className, ...props }: React.ComponentProps<typeof ContextMenuContent>) {
  return <ContextMenuContent className={cn(contentCls, className)} {...props} />
}

export function FmMenuSubContent({ className, ...props }: React.ComponentProps<typeof ContextMenuSubContent>) {
  return <ContextMenuSubContent className={cn(contentCls, className)} {...props} />
}

export function FmMenuItem({
  className,
  danger,
  ...props
}: React.ComponentProps<typeof ContextMenuItem> & { danger?: boolean }) {
  return (
    <ContextMenuItem
      className={cn(itemCls, danger && "text-accent-red focus:text-accent-red focus:[&_svg]:text-accent-red", className)}
      {...props}
    />
  )
}

export function FmMenuSubTrigger({ className, ...props }: React.ComponentProps<typeof ContextMenuSubTrigger>) {
  return <ContextMenuSubTrigger className={cn(itemCls, "data-[state=open]:bg-panel-hover", className)} {...props} />
}

export function FmMenuSeparator({ className, ...props }: React.ComponentProps<typeof ContextMenuSeparator>) {
  return <ContextMenuSeparator className={cn("-mx-0.5 my-1 h-px bg-panel-border", className)} {...props} />
}

/** a checkable row inside a sort / view submenu */
export function FmMenuChoice({
  checked,
  children,
  ...props
}: React.ComponentProps<typeof ContextMenuItem> & { checked?: boolean }) {
  return (
    <FmMenuItem {...props}>
      <Check className={cn("transition-opacity", checked ? "opacity-100" : "opacity-0")} aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </FmMenuItem>
  )
}

export { ContextMenu as FmMenu, ContextMenuSub as FmMenuSub, ContextMenuTrigger as FmMenuTrigger }

/**
 * Open the menu of a focused row from the keyboard. Radix listens for a real
 * `contextmenu` event on its trigger, so Shift+F10 and the Menu key are
 * forwarded as one, anchored at the row's left edge.
 */
export function openMenuAt(element: HTMLElement | null) {
  if (!element) return
  const rect = element.getBoundingClientRect()
  element.dispatchEvent(
    new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: Math.round(rect.left + 24),
      clientY: Math.round(rect.top + rect.height / 2),
    }),
  )
}

/** true for the two keystrokes that mean "open the context menu" */
export const isMenuKey = (event: React.KeyboardEvent) =>
  event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")
