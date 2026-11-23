/**
 * Lightweight 60fps GPU-Accelerated Neon Confetti Burst around the Robot Visor
 */

const PALETTES = {
  cyan: ["#7bf8ff", "#00f2fe", "#38bdf8", "#a5f3fc", "#fde047"],
  sakura: ["#fbcfe8", "#ff6ec7", "#f43f5e", "#fda4af", "#fde047"],
  emerald: ["#a7f3d0", "#34d399", "#10b981", "#6ee7b7", "#fef08a"],
  violet: ["#e9d5ff", "#c084fc", "#8b5cf6", "#f472b6", "#7bf8ff"],
  gold: ["#fef9c3", "#facc15", "#f59e0b", "#fb923c", "#ffffff"],
};

export function spawnNeonConfetti(containerEl, count = 22) {
  if (!containerEl) return;
  const theme = document.body.dataset.theme || "cyan";
  const colors = PALETTES[theme] || PALETTES.cyan;

  for (let i = 0; i < count; i++) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";

    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.45;
    const dist = 54 + Math.random() * 58;
    const tx = Math.cos(angle) * dist;
    const ty = Math.sin(angle) * dist - 14;
    const rot = Math.round((Math.random() - 0.5) * 540);
    const color = colors[i % colors.length];
    const size = 4 + Math.random() * 3.5;

    piece.style.setProperty("--tx", `${tx.toFixed(1)}px`);
    piece.style.setProperty("--ty", `${ty.toFixed(1)}px`);
    piece.style.setProperty("--rot", `${rot}deg`);
    piece.style.background = color;
    piece.style.boxShadow = `0 0 8px ${color}`;
    piece.style.width = `${size.toFixed(1)}px`;
    piece.style.height = `${(size * (Math.random() > 0.5 ? 1.5 : 1)).toFixed(1)}px`;

    containerEl.appendChild(piece);
    window.setTimeout(() => {
      piece.remove();
    }, 920);
  }
}
