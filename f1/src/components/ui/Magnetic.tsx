"use client";
import Link from "next/link";
import { useRef, type ComponentProps, type ReactNode } from "react";
import { useSettings } from "@/lib/settings";

function useMagnet<T extends HTMLElement>(strength = 0.25) {
  const ref = useRef<T | null>(null);
  const { settings } = useSettings();
  return {
    ref,
    onPointerMove: (e: React.PointerEvent<T>) => {
      if (!settings.motion || e.pointerType !== "mouse" || !ref.current) return;
      const r = ref.current.getBoundingClientRect();
      const x = (e.clientX - (r.left + r.width / 2)) * strength;
      const y = (e.clientY - (r.top + r.height / 2)) * strength;
      ref.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    },
    onPointerLeave: () => {
      if (ref.current) ref.current.style.transform = "";
    },
  };
}

const base =
  "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-[transform,background-color,border-color,box-shadow] duration-300 ease-[cubic-bezier(.2,.9,.25,1)] will-change-transform";
const variants = {
  primary: "bg-gradient-to-b from-[#ff5a3c] to-[#e8261b] text-white shadow-[0_8px_24px_-8px_rgba(255,59,48,.7)] hover:shadow-[0_12px_30px_-8px_rgba(255,59,48,.85)]",
  glass: "border border-white/12 bg-white/[.06] text-white hover:bg-white/[.12] hover:border-white/25 backdrop-blur-md",
  ghost: "text-white/80 hover:text-white hover:bg-white/[.07]",
};

export function MagneticButton({ variant = "glass", className = "", children, ...rest }: ComponentProps<"button"> & { variant?: keyof typeof variants; children: ReactNode }) {
  const m = useMagnet<HTMLButtonElement>();
  return (
    <button type="button" {...rest} ref={m.ref} onPointerMove={m.onPointerMove} onPointerLeave={m.onPointerLeave} className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
}

export function MagneticLink({ variant = "glass", className = "", children, ...rest }: ComponentProps<typeof Link> & { variant?: keyof typeof variants }) {
  const m = useMagnet<HTMLAnchorElement>();
  return (
    <Link {...rest} ref={m.ref} onPointerMove={m.onPointerMove} onPointerLeave={m.onPointerLeave} className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </Link>
  );
}
