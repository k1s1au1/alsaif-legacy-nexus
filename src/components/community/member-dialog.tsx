import { useCallback, useEffect, useRef, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import "./member-dialog.css";

type MemberDialogProps = {
  title: string;
  description: string;
  icon?: ReactNode;
  wide?: boolean;
  onClose: () => void;
  children: ReactNode;
};

export function MemberDialog({ title, description, icon, wide, onClose, children }: MemberDialogProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  // Mobile keyboards can resize/pan the visual viewport without changing vh.
  const syncViewport = useCallback(() => {
    const viewport = window.visualViewport;
    const style = viewportRef.current?.style;
    if (!viewport || !style) return;
    style.setProperty("--member-dialog-top", `${viewport.offsetTop}px`);
    style.setProperty("--member-dialog-left", `${viewport.offsetLeft}px`);
    style.setProperty("--member-dialog-width", `${viewport.width}px`);
    style.setProperty("--member-dialog-height", `${viewport.height}px`);
  }, []);

  const attachViewport = useCallback((node: HTMLDivElement | null) => {
    viewportRef.current = node;
    // Radix mounts the portal after the parent has mounted.
    syncViewport();
  }, [syncViewport]);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    syncViewport();
    viewport.addEventListener("resize", syncViewport);
    viewport.addEventListener("scroll", syncViewport);
    return () => {
      viewport.removeEventListener("resize", syncViewport);
      viewport.removeEventListener("scroll", syncViewport);
    };
  }, [syncViewport]);

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      {/* Escape the route/section transforms that otherwise trap fixed dialogs. */}
      <Dialog.Portal>
        <Dialog.Overlay ref={attachViewport} className="member-dialog-viewport">
          <Dialog.Content
            ref={contentRef}
            dir="rtl"
            className={cn("member-dialog-panel", wide && "member-dialog-panel-wide")}
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              returnFocusRef.current = document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;
              // Opening a form should not immediately summon the mobile keyboard.
              contentRef.current?.focus({ preventScroll: true });
            }}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              if (returnFocusRef.current?.isConnected) {
                returnFocusRef.current.focus({ preventScroll: true });
              }
            }}
            onInteractOutside={(event) => event.preventDefault()}
          >
            <header className="member-dialog-header">
              <div className="flex min-w-0 items-center gap-3">
                {icon && (
                  <div className="size-10 shrink-0 rounded-2xl bg-primary flex items-center justify-center text-white">
                    {icon}
                  </div>
                )}
                <Dialog.Title className="text-lg md:text-xl font-black text-primary break-words line-clamp-2">
                  {title}
                </Dialog.Title>
              </div>
              <Dialog.Close
                aria-label="إغلاق النافذة"
                className="size-10 shrink-0 rounded-full bg-muted flex items-center justify-center"
              >
                <X size={20} />
              </Dialog.Close>
            </header>
            <Dialog.Description className="sr-only">{description}</Dialog.Description>
            {children}
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
