// Shared shape drawing so characters, enemies and menu icons look identical.
export function pathShape(ctx, shape, x, y, r, rot = 0) {
  ctx.beginPath();
  const poly = (n, off = 0) => {
    for (let i = 0; i < n; i++) {
      const a = rot + off + (i / n) * Math.PI * 2;
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
  };
  switch (shape) {
    case 'square': { // rotated rounded-ish square
      const h = r * 0.88; ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.rect(-h, -h, h * 2, h * 2); ctx.restore(); break;
    }
    case 'triangle': poly(3); break;
    case 'diamond': poly(4); break;
    case 'hex': poly(6); break;
    default: ctx.arc(x, y, r, 0, Math.PI * 2);
  }
}

export function drawShape(ctx, def, x, y, r, rot = 0, fill = def.color) {
  pathShape(ctx, def.shape, x, y, r, rot);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.stroke();
}
