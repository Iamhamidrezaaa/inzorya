import { cn } from "@/lib/utils";

/**
 * Later-style wordmark: white face, black stroke, elongated black extrusion.
 */
export function InzoryaWordmark({ className }: { className?: string }) {
  // Longer solid extrusion (Later-style block shadow)
  const offsets = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

  return (
    <span
      className={cn(
        "relative inline-block select-none pb-[10px] pr-[10px] text-[2.55rem] font-black leading-none tracking-[-0.055em] sm:text-[2.95rem]",
        className,
      )}
      aria-label="Inzorya"
    >
      {offsets.map((n) => (
        <span
          key={n}
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 text-[#0a0a0a]"
          style={{ transform: `translate(${n}px, ${n}px)` }}
        >
          Inzorya
        </span>
      ))}
      <span
        className="marketing-wordmark-face relative text-white"
        style={{
          WebkitTextStroke: "3.35px #0a0a0a",
          paintOrder: "stroke fill",
        }}
      >
        Inzorya
      </span>
    </span>
  );
}
