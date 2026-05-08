import { motion } from "framer-motion";

export function AiGlobe() {
  const rings = [
    { size: 320, dur: 22, tilt: 0 },
    { size: 420, dur: 30, tilt: 60 },
    { size: 520, dur: 40, tilt: 120 },
  ];
  const dots = Array.from({ length: 8 });

  return (
    <div className="pointer-events-none relative mx-auto h-[560px] w-[560px] max-w-full">
      {/* core glow */}
      <div
        className="absolute inset-0 m-auto h-40 w-40 rounded-full blur-3xl"
        style={{ background: "var(--gradient-hero)", animation: "pulse-glow 4s ease-in-out infinite" }}
      />
      <div className="absolute inset-0 m-auto flex h-32 w-32 items-center justify-center rounded-full glass glow-ring">
        <span className="font-mono text-xs tracking-widest text-primary">PIKR.AI</span>
      </div>

      {rings.map((r, i) => (
        <motion.div
          key={i}
          className="absolute inset-0 m-auto rounded-full border"
          style={{
            width: r.size,
            height: r.size,
            borderColor: "color-mix(in oklab, var(--cyan) 40%, transparent)",
            transform: `rotateX(70deg) rotateZ(${r.tilt}deg)`,
          }}
          animate={{ rotateZ: [r.tilt, r.tilt + 360] }}
          transition={{ duration: r.dur, repeat: Infinity, ease: "linear" }}
        >
          {dots.slice(0, 3 + i).map((_, j, arr) => {
            const angle = (j / arr.length) * 360;
            return (
              <span
                key={j}
                className="absolute left-1/2 top-1/2 h-2 w-2 rounded-full"
                style={{
                  background: j % 2 ? "var(--violet)" : "var(--cyan)",
                  boxShadow: "0 0 12px currentColor",
                  color: j % 2 ? "var(--violet)" : "var(--cyan)",
                  transform: `rotate(${angle}deg) translateX(${r.size / 2}px)`,
                }}
              />
            );
          })}
        </motion.div>
      ))}

      {/* orbiting tags */}
      {["scrape", "embed", "reason", "api", "agent"].map((label, i) => (
        <div
          key={label}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{
            ["--r" as string]: `${180 + i * 18}px`,
            animation: `orbit ${14 + i * 4}s linear infinite`,
            animationDelay: `${-i * 2}s`,
          }}
        >
          <div className="font-mono text-[10px] uppercase tracking-widest glass rounded-full px-2.5 py-1 text-muted-foreground">
            {label}
          </div>
        </div>
      ))}
    </div>
  );
}
