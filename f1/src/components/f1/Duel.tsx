export function Duel({ label, a, b, ca, cb }: { label: string; a: number; b: number; ca: string; cb: string }) {
  const tot = Math.max(1, a + b);
  return (
    <div className="mt-4">
      <div className="mb-1 flex items-center justify-between text-xs text-white/55"><b className="num text-base text-white">{a}</b><span>{label}</span><b className="num text-base text-white">{b}</b></div>
      <div className="flex h-1.5 gap-1 overflow-hidden rounded-full" role="img" aria-label={`${a} – ${b}`}>
        <span className="rounded-full" style={{ width: `${(a / tot) * 100}%`, background: ca }} /><span className="rounded-full" style={{ width: `${(b / tot) * 100}%`, background: cb }} />
      </div>
    </div>
  );
}
