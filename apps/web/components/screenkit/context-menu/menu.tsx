"use client"

import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { cn } from "@/lib/utils"
import * as React from "react"
import { isRadio, type MenuModel } from "./model"

/* ------------------------------------------------------------------ *
 * the context menu surface in the design system: rounded, monospace,
 * lowercase, tokens only. `data-sk-surface="menu"` lets the glass effect
 * pick it up. Radix opens it on right-click and on a touch long-press.
 *
 * The model is built lazily when the menu opens so a list of two hundred
 * cards does not compute two hundred menus on every render.
 * ------------------------------------------------------------------ */

const itemCls =
  "gap-2.5 rounded-xl px-2.5 py-2 font-mono text-xs lowercase text-text-secondary focus:bg-panel-hover focus:text-foreground data-[disabled]:opacity-40 [&_svg]:size-3.5 [&_svg]:text-text-faint focus:[&_svg]:text-foreground"

export const menuContentCls =
  "min-w-56 max-w-[min(92vw,20rem)] rounded-2xl border-panel-border bg-popover/95 p-1.5 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.7)] backdrop-blur-md"

export function SkContextMenu({
  build,
  disabled,
  children,
  className,
  asChild = true,
}: {
  /** builds the model when the menu opens */
  build: () => MenuModel
  disabled?: boolean
  children: React.ReactNode
  className?: string
  asChild?: boolean
}) {
  const [model, setModel] = React.useState<MenuModel | null>(null)
  if (disabled) return <>{children}</>
  return (
    <ContextMenu
      onOpenChange={(open) => {
        if (open) setModel(build())
        else setModel(null)
      }}
    >
      <ContextMenuTrigger asChild={asChild} className={className}>
        {children}
      </ContextMenuTrigger>
      {model ? <MenuBody model={model} /> : null}
    </ContextMenu>
  )
}

function MenuBody({ model }: { model: MenuModel }) {
  return (
    <ContextMenuContent data-sk-surface="menu" className={menuContentCls}>
      {model.title ? (
        <ContextMenuLabel className="truncate px-2.5 pb-1.5 pt-1 font-mono text-[10px] lowercase text-text-faint">{model.title}</ContextMenuLabel>
      ) : null}
      {model.groups.map((group, index) => (
        <React.Fragment key={group.id}>
          {index > 0 || model.title ? <ContextMenuSeparator className="my-1 bg-panel-border" /> : null}
          {group.label ? (
            <ContextMenuLabel className="px-2.5 pb-1 pt-1.5 font-mono text-[10px] uppercase tracking-wide text-text-faint">{group.label}</ContextMenuLabel>
          ) : null}
          {group.entries.map((entry) => {
            if (isRadio(entry)) {
              const Icon = entry.icon
              return (
                <ContextMenuSub key={entry.id}>
                  <ContextMenuSubTrigger className={itemCls}>
                    {Icon ? <Icon /> : null}
                    <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                    <span className="ml-2 text-[10px] text-text-faint">
                      {entry.options.find((option) => option.value === entry.value)?.label}
                    </span>
                  </ContextMenuSubTrigger>
                  <ContextMenuSubContent data-sk-surface="menu" className={menuContentCls}>
                    <ContextMenuRadioGroup value={entry.value} onValueChange={entry.onChange}>
                      {entry.options.map((option) => (
                        <ContextMenuRadioItem key={option.value} value={option.value} className={cn(itemCls, "pl-7")}>
                          {option.label}
                        </ContextMenuRadioItem>
                      ))}
                    </ContextMenuRadioGroup>
                  </ContextMenuSubContent>
                </ContextMenuSub>
              )
            }
            const Icon = entry.icon
            if (entry.checked !== undefined) {
              return (
                <ContextMenuCheckboxItem
                  key={entry.id}
                  checked={entry.checked}
                  disabled={entry.disabled}
                  onCheckedChange={() => entry.run()}
                  className={cn(itemCls, "pl-7")}
                >
                  {Icon ? <Icon /> : null}
                  <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                  {entry.shortcut ? <Kbd>{entry.shortcut}</Kbd> : null}
                </ContextMenuCheckboxItem>
              )
            }
            return (
              <ContextMenuItem
                key={entry.id}
                disabled={entry.disabled}
                onSelect={() => entry.run()}
                className={cn(itemCls, entry.danger && "text-accent-red focus:text-accent-red [&_svg]:text-accent-red focus:[&_svg]:text-accent-red")}
              >
                {Icon ? <Icon /> : null}
                <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                {entry.shortcut ? <Kbd>{entry.shortcut}</Kbd> : null}
              </ContextMenuItem>
            )
          })}
        </React.Fragment>
      ))}
    </ContextMenuContent>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="ml-3 rounded-md border border-panel-border bg-panel-soft px-1.5 py-0.5 font-mono text-[10px] text-text-faint">{children}</kbd>
  )
}
