"use client";
import { useEffect, useRef } from "react";

/** Fixed background whose light pool drifts toward the cursor (one rAF-throttled listener for the whole app). */
export function AmbientBackground() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const el = ref.current;
    if (!el || window.matchMedia("(pointer: coarse)").matches) return;
    const on = (e: PointerEvent) => {
      if (document.documentElement.dataset.motion === "off") return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        // Parallax: only follows a fraction of the cursor travel.
        el.style.setProperty("--bx", String(40 + (e.clientX / window.innerWidth) * 50));
        el.style.setProperty("--by", String(0 + (e.clientY / window.innerHeight) * 35));
      });
    };
    window.addEventListener("pointermove", on, { passive: true });
    return () => {
      window.removeEventListener("pointermove", on);
      cancelAnimationFrame(raf);
    };
  }, []);
  return <div ref={ref} className="ambient" aria-hidden />;
}
