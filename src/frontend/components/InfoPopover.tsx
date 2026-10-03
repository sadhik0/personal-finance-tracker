"use client";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState, type ReactNode } from "react";

type Position = { left: number; top: number; placement: "above" | "below" };

export default function InfoPopover({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<Position>({ left: 16, top: 16, placement: "below" });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLSpanElement>(null);

  function updatePosition() {
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const width = Math.min(340, window.innerWidth - 24);
    const estimatedHeight = Math.min(360, window.innerHeight * 0.7);
    const left = Math.min(Math.max(12, rect.right - width), window.innerWidth - width - 12);
    const roomBelow = window.innerHeight - rect.bottom - 12;
    const placement = roomBelow < Math.min(estimatedHeight, 260) && rect.top > estimatedHeight + 12 ? "above" : "below";
    const top = placement === "above" ? Math.max(12, rect.top - estimatedHeight - 8) : rect.bottom + 8;
    setPosition({ left, top, placement });
  }

  function toggle() {
    if (!open) updatePosition();
    setOpen((value) => !value);
  }

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!buttonRef.current?.contains(target) && !popoverRef.current?.contains(target)) setOpen(false);
    };
    const reposition = () => updatePosition();
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("mousedown", closeOnOutsideClick);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("mousedown", closeOnOutsideClick);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open]);

  const popup = open ? (
    <span
      ref={popoverRef}
      role="dialog"
      aria-label={label}
      style={{ left: position.left, top: position.top }}
      className="fixed z-[9999] max-h-[min(360px,70vh)] w-[min(340px,calc(100vw-24px))] overflow-y-auto rounded-xl border border-[#334155] bg-[#111827] p-4 text-left text-sm leading-5 text-[#CBD5E1] shadow-2xl"
    >
      {children}
    </span>
  ) : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={toggle}
        className="ml-2 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-[#64748B] text-[10px] text-[#CBD5E1] hover:border-[#38BDF8] hover:text-[#38BDF8]"
      >
        i
      </button>
      {typeof document !== "undefined" && popup ? createPortal(popup, document.body) : null}
    </>
  );
}
