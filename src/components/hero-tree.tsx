/**
 * The landing hero: a family tree presented the way families actually keep
 * them — mounted on an album page. Double mat, a whispered memory in the
 * margin, a handwritten caption underneath. Fuzzy dates, a dashed "unknown
 * ancestor", one gold story star.
 *
 * Pure SVG, server-rendered, no JS. On load the tree draws itself in once
 * (lines first, then people) — the page's single orchestrated moment,
 * switched off entirely under prefers-reduced-motion.
 */

const NODE_W = 124;
const NODE_H = 52;
const UNKNOWN_H = 44;

function Node({
  cx,
  y,
  name,
  years,
  variant = "default",
  delay = 0,
}: {
  cx: number;
  y: number;
  name: string;
  years: string;
  variant?: "default" | "unknown" | "you" | "departed";
  delay?: number;
}) {
  const x = cx - NODE_W / 2;
  const midY = y + NODE_H / 2;
  const style = { animationDelay: `${delay}s` };

  if (variant === "unknown") {
    return (
      <g className="tree-node" style={style}>
        <rect
          x={x}
          y={y}
          width={NODE_W}
          height={UNKNOWN_H}
          rx={12}
          fill="none"
          stroke="var(--color-ink-soft)"
          strokeWidth={1.25}
          strokeDasharray="5 5"
        />
        <text
          x={cx}
          y={y + 19}
          textAnchor="middle"
          fontSize={13}
          fill="var(--color-ink-soft)"
        >
          ? great-grandfather
        </text>
        <text
          x={cx}
          y={y + 34}
          textAnchor="middle"
          fontSize={10.5}
          fill="var(--color-ink-soft)"
          opacity={0.8}
        >
          {years}
        </text>
      </g>
    );
  }

  const isYou = variant === "you";
  const isDeparted = variant === "departed";
  return (
    <g className="tree-node" style={style}>
      <rect
        x={x}
        y={y}
        width={NODE_W}
        height={NODE_H}
        rx={12}
        fill={isYou ? "var(--color-evergreen)" : "var(--color-card)"}
        stroke={
          isYou ? "var(--color-evergreen)" : "var(--color-line)"
        }
        strokeWidth={1.25}
      />
      <text
        x={cx}
        y={midY - 4}
        textAnchor="middle"
        fontSize={13.5}
        fontWeight={500}
        fill={
          isYou
            ? "var(--color-paper)"
            : isDeparted
              ? "var(--color-rosewood)"
              : "var(--color-ink)"
        }
        style={{ fontFamily: "var(--font-display)" }}
      >
        {name}
      </text>
      <text
        x={cx}
        y={midY + 13}
        textAnchor="middle"
        fontSize={10.5}
        fill={isYou ? "var(--color-paper)" : "var(--color-ink-soft)"}
        opacity={0.85}
      >
        {years}
      </text>
    </g>
  );
}

function Line({
  x1,
  y1,
  x2,
  y2,
  dashed = false,
  delay = 0,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  dashed?: boolean;
  delay?: number;
}) {
  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke="var(--color-ink-soft)"
      strokeWidth={1.4}
      strokeLinecap="round"
      opacity={0.65}
      strokeDasharray={dashed ? "5 5" : undefined}
      pathLength={1}
      style={{ animationDelay: `${delay}s` }}
    />
  );
}

export function HeroTree({ className = "" }: { className?: string }) {
  return (
    <figure className={`w-full max-w-md justify-self-center ${className}`}>
      {/* the album mount */}
      <div
        className="rounded-3xl border border-line bg-card p-5 sm:p-7"
        style={{
          boxShadow:
            "0 1px 2px rgba(28,36,32,0.04), 0 14px 36px rgba(28,36,32,0.07)",
        }}
      >
        <div className="overflow-hidden rounded-2xl border border-evergreen/15 bg-paper px-3 py-4 sm:px-5">
          <svg
            viewBox="0 0 560 412"
            className="tree-draw w-full"
            role="img"
            aria-label="A small example family tree with fuzzy dates, an unknown great-grandfather, and a family memory attached to a grandmother"
          >
            {/* unknown great-grandfather, above Dada Yusuf */}
            <Node cx={76} y={6} name="?" years="c. 1885, somewhere in Punjab" variant="unknown" delay={0.15} />
            <Line x1={76} y1={50} x2={76} y2={88} delay={0.05} />

            {/* grandparents */}
            <Node cx={76} y={88} name="Dada Yusuf" years="1918 – 2004" variant="departed" delay={0.35} />
            <Node cx={216} y={88} name="Dadi Amna" years="1922 – 1998" variant="departed" delay={0.42} />
            <Node cx={344} y={88} name="Nana Kareem" years="1925 – 2011" variant="departed" delay={0.49} />
            <Node cx={484} y={88} name="Nani Zainab" years="b. 1930" delay={0.56} />

            {/* a whispered memory, in the margin of the album page */}
            <g className="tree-node" style={{ animationDelay: "0.85s" }}>
              <text
                x={222}
                y={74}
                fontSize={11}
                fill="var(--color-gold)"
                fontStyle="italic"
              >
                ✻ her rotis were legendary
              </text>
            </g>

            {/* couple connectors + drops to parents */}
            <Line x1={138} y1={114} x2={154} y2={114} delay={0.35} />
            <Line x1={146} y1={114} x2={146} y2={204} delay={0.4} />
            <Line x1={406} y1={114} x2={422} y2={114} delay={0.35} />
            <Line x1={414} y1={114} x2={414} y2={204} delay={0.4} />

            {/* parents */}
            <Node cx={146} y={204} name="Abbu" years="b. 1952" delay={0.6} />
            <Node cx={414} y={204} name="Ami" years="b. 1955" delay={0.66} />

            {/* parents' union and the sibling bus */}
            <Line x1={208} y1={230} x2={352} y2={230} delay={0.6} />
            <Line x1={280} y1={230} x2={280} y2={300} delay={0.65} />
            <Line x1={140} y1={300} x2={420} y2={300} delay={0.7} />
            <Line x1={140} y1={300} x2={140} y2={334} delay={0.75} />
            <Line x1={280} y1={300} x2={280} y2={334} delay={0.75} />
            <Line x1={420} y1={300} x2={420} y2={334} delay={0.75} />

            {/* children */}
            <Node cx={140} y={334} name="Sara" years="b. 1984" delay={0.85} />
            <Node cx={280} y={334} name="You" years="b. 1989" variant="you" delay={0.92} />
            <Node cx={420} y={334} name="Bilal" years="b. 1992" delay={0.99} />
          </svg>
        </div>
      </div>
      <figcaption className="mt-3.5 text-center font-display text-sm italic text-ink-soft">
        Abbu&rsquo;s side, as far as anyone remembers
      </figcaption>
    </figure>
  );
}
