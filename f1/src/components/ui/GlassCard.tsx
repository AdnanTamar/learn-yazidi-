"use client";
import { useRef, type CSSProperties, type ElementType, type HTMLAttributes, type ReactNode } from "react";
import { useSettings } from "@/lib/settings";

interface Props extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  /** Max tilt in degrees (0 disables tilt but keeps the moving glare). */
  tilt?: number;
  accent?: string;
  children?: ReactNode;
}

/**
 * Glass surface that leans toward the cursor and carries a moving highlight.
 * Pointer handling is rAF-throttled and only runs for a real mouse (not touch).
 */
export function GlassCard({ as: Tag = "div", tilt = 4, accent, className = "", style, children, ...rest }: Props) {
  const ref = useRef<HTMLElement | null>(null);
  const raf = useRef(0);
  const { settings } = useSettings();

  const onMove = (e: React.PointerEvent<HTMLElement>) => {
    rest.onPointerMove?.(e as never);
    if (!settings.motion || e.pointerType !== "mouse") return;
    const el = ref.current;
    if (!el) return;
    const { clientX, clientY } = e;
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const r = el.getBoundingClientRect();
      const px = (clientX - r.left) / r.width;
      const py = (clientY - r.top) / r.height;
      el.classList.add("tracking");
      el.style.setProperty("--gx", `${px * 100}%`);
      el.style.setProperty("--gy", `${py * 100}%`);
      if (tilt) {
        // Larger surfaces lean less so wide cards do not feel floppy.
        const k = Math.min(1, 420 / r.width);
        el.style.setProperty("--ry", `${(px - 0.5) * 2 * tilt * k}deg`);
        el.style.setProperty("--rx", `${-(py - 0.5) * 2 * tilt * k}deg`);
      }
    });
  };
  const onLeave = (e: React.PointerEvent<HTMLElement>) => {
    rest.onPointerLeave?.(e as never);
    cancelAnimationFrame(raf.current);
    const el = ref.current;
    if (!el) return;
    el.classList.remove("tracking");
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  };

  return (
    <Tag
      {...rest}
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className={`glass glare ${tilt ? "tilt" : ""} ${accent ? "accent-card" : ""} ${className}`}
      style={{ ...(accent ? ({ "--accent-c": accent } as CSSProperties) : null), ...style }}
    >
      {children}
    </Tag>
  );
}
