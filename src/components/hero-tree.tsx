/**
 * The landing hero: a small, warm family tree that demonstrates the product's
 * soul — fuzzy dates, a dashed "unknown ancestor", one whispered memory.
 * Pure SVG, server-rendered, no JS.
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
}: {
  cx: number;
  y: number;
  name: string;
  years: string;
  variant?: "default" | "unknown" | "you";
}) {
  const x = cx - NODE_W / 2;
  const midY = y + NODE_H / 2;
  if (variant === "unknown") {
    return (
      <g>
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
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={NODE_W}
        height={NODE_H}
        rx={12}
        fill={isYou ? "var(--color-evergreen)" : "#fffdf8"}
        stroke={isYou ? "var(--color-evergreen)" : "var(--color-line)"}
        strokeWidth={1.25}
      />
      <text
        x={cx}
        y={midY - 4}
        textAnchor="middle"
        fontSize={13.5}
        fontWeight={500}
        fill={isYou ? "var(--color-paper)" : "var(--color-ink)"}
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
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  dashed?: boolean;
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
    />
  );
}

export function HeroTree({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 560 412"
      className={`w-full max-w-md justify-self-center ${className}`}
      role="img"
      aria-label="A small example family tree with fuzzy dates, an unknown great-grandfather, and a family memory attached to a grandmother"
    >
      {/* unknown great-grandfather, above Dada Yusuf */}
      <Node cx={76} y={6} name="?" years="c. 1885, somewhere in Punjab" variant="unknown" />
      <Line x1={76} y1={50} x2={76} y2={88} />

      {/* grandparents */}
      <Node cx={76} y={88} name="Dada Yusuf" years="1918 – 2004" />
      <Node cx={216} y={88} name="Dadi Amna" years="1922 – 1998" />
      <Node cx={344} y={88} name="Nana Kareem" years="1925 – 2011" />
      <Node cx={484} y={88} name="Nani Zainab" years="b. 1930" />

      {/* a whispered memory */}
      <text
        x={222}
        y={74}
        fontSize={11}
        fill="var(--color-gold)"
        fontStyle="italic"
      >
        ✻ her rotis were legendary
      </text>

      {/* couple connectors + drops to parents */}
      <Line x1={138} y1={114} x2={154} y2={114} />
      <Line x1={146} y1={114} x2={146} y2={204} />
      <Line x1={406} y1={114} x2={422} y2={114} />
      <Line x1={414} y1={114} x2={414} y2={204} />

      {/* parents */}
      <Node cx={146} y={204} name="Abbu" years="b. 1952" />
      <Node cx={414} y={204} name="Ami" years="b. 1955" />

      {/* parents' union and the sibling bus */}
      <Line x1={208} y1={230} x2={352} y2={230} />
      <Line x1={280} y1={230} x2={280} y2={300} />
      <Line x1={140} y1={300} x2={420} y2={300} />
      <Line x1={140} y1={300} x2={140} y2={334} />
      <Line x1={280} y1={300} x2={280} y2={334} />
      <Line x1={420} y1={300} x2={420} y2={334} />

      {/* children */}
      <Node cx={140} y={334} name="Sara" years="b. 1984" />
      <Node cx={280} y={334} name="You" years="b. 1989" variant="you" />
      <Node cx={420} y={334} name="Bilal" years="b. 1992" />
    </svg>
  );
}
