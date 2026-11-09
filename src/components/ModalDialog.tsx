"use client";

import { useLayoutEffect, useRef, type CSSProperties, type KeyboardEvent, type ReactNode, type RefObject } from "react";

const focusableSelector = "button, a[href], input, select, textarea, video[controls], audio[controls], [tabindex]";

type Props = {
  label: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  onDismiss: () => void;
  onKeyDown?: (event: KeyboardEvent<HTMLDialogElement>) => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
  dismissible?: boolean;
};

export function ModalDialog({ label, className, style, children, onDismiss, onKeyDown, returnFocusRef, dismissible = true }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const backdropPress = useRef(false);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const opener = returnFocusRef?.current ?? document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    dialog.querySelector<HTMLElement>("[data-dialog-initial-focus]:not(:disabled)")?.focus({ preventScroll: true });

    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (opener instanceof HTMLElement && opener.isConnected) {
        opener.focus({ preventScroll: true });
      }
    };
  }, [returnFocusRef]);

  return (
    <dialog
      ref={dialogRef}
      aria-label={label}
      className={`fixed inset-0 m-0 size-full max-h-none max-w-none overflow-hidden bg-transparent p-0 ${className ?? ""}`}
      style={style}
      onCancel={(event) => {
        event.preventDefault();
        if (dismissible) onDismiss();
      }}
      onPointerDown={(event) => {
        backdropPress.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (dismissible && backdropPress.current && event.target === event.currentTarget) onDismiss();
        backdropPress.current = false;
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented || event.key !== "Tab") return;
        const active = document.activeElement;
        // Let the browser navigate the built-in controls inside media.
        if (active instanceof HTMLMediaElement) return;
        const tabStops = [...event.currentTarget.querySelectorAll<HTMLElement>(focusableSelector)].filter(
          (item) =>
            (item.tabIndex >= 0 || (item instanceof HTMLMediaElement && !item.hasAttribute("tabindex"))) &&
            !item.matches(":disabled") &&
            item.getClientRects().length &&
            getComputedStyle(item).visibility === "visible",
        );
        const edge = event.shiftKey ? tabStops[0] : tabStops.at(-1);
        const opposite = event.shiftKey ? tabStops.at(-1) : tabStops[0];
        if (active === edge && opposite) {
          event.preventDefault();
          opposite.focus();
        }
      }}
    >
      {children}
    </dialog>
  );
}
