import * as React from "react";
import * as ContextMenuPrimitive from "@radix-ui/react-context-menu";
import { cn } from "@/lib/utils";

export const ContextMenu = ContextMenuPrimitive.Root;
export const ContextMenuTrigger = ContextMenuPrimitive.Trigger;
export const ContextMenuSub = ContextMenuPrimitive.Sub;
export const ContextMenuSubTrigger = ContextMenuPrimitive.SubTrigger;

const itemClass =
  "flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-[13px] text-ink-primary outline-none transition-colors focus:bg-surface-sunken data-[disabled]:pointer-events-none data-[disabled]:opacity-50";

export const ContextMenuContent = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Content>
>(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.Portal>
    <ContextMenuPrimitive.Content
      ref={ref}
      className={cn(
        "z-50 min-w-[11rem] overflow-hidden rounded-md border border-[var(--border)] bg-surface-primary p-1 shadow-panel",
        className
      )}
      {...props}
    />
  </ContextMenuPrimitive.Portal>
));
ContextMenuContent.displayName = "ContextMenuContent";

export const ContextMenuItem = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Item>
>(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.Item ref={ref} className={cn(itemClass, className)} {...props} />
));
ContextMenuItem.displayName = "ContextMenuItem";

export const ContextMenuSeparator = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.Separator
    ref={ref}
    className={cn("my-1 h-px bg-[var(--border)]", className)}
    {...props}
  />
));
ContextMenuSeparator.displayName = "ContextMenuSeparator";

export const ContextMenuSubContent = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.SubContent>
>(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.Portal>
    <ContextMenuPrimitive.SubContent
      ref={ref}
      className={cn(
        "z-50 min-w-[9rem] overflow-hidden rounded-md border border-[var(--border)] bg-surface-primary p-1 shadow-panel",
        className
      )}
      {...props}
    />
  </ContextMenuPrimitive.Portal>
));
ContextMenuSubContent.displayName = "ContextMenuSubContent";

export const subTriggerClass = itemClass;
