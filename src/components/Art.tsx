// Home-card illustrations: flat, sunny, drawn in the brand palette. Decorative only (aria-hidden).
import type { ReactNode } from "react";

const N = "#0B2545"; // ink
const B = "#1557E0"; // primary
const T = "#0FB5AE"; // teal
const TD = "#0A7C78";
const G = "#FFB627"; // gold
const GL = "#FFD36B";
const L = "#FF4F8B"; // lotus
const S = "#E8F1FF"; // sky
const M = "#DDF7F5"; // mint
const W = "#FFFFFF";

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 160 120" className="h-full w-full" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}
const Spark = ({ x, y, s = 1, c = G }: { x: number; y: number; s?: number; c?: string }) => (
  <path transform={`translate(${x} ${y}) scale(${s})`} d="M0-8C1 -3 3 -1 8 0 3 1 1 3 0 8-1 3-3 1-8 0-3-1-1-3 0-8Z" fill={c} />
);
const Plane = ({ x, y, s = 1, c = B, r = 0 }: { x: number; y: number; s?: number; c?: string; r?: number }) => (
  <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
    <path d="M-14 3 14-9c2-1 3 1 1 3L5 4 2 14c-1 2-3 2-3 0L-2 6-10 4c-2-1-2-2 0-1Z" fill={c} />
  </g>
);
const Sun = ({ x, y, r = 12 }: { x: number; y: number; r?: number }) => (
  <g>
    <circle cx={x} cy={y} r={r + 7} fill={GL} opacity=".35" />
    <circle cx={x} cy={y} r={r} fill={G} />
    <circle cx={x - 4} cy={y - 1} r="1.6" fill={N} />
    <circle cx={x + 4} cy={y - 1} r="1.6" fill={N} />
    <path d={`M${x - 4} ${y + 4}q4 4 8 0`} stroke={N} strokeWidth="1.6" strokeLinecap="round" fill="none" />
  </g>
);
const Person = ({ x, y, c = B, skin = "#F4C7A1" }: { x: number; y: number; c?: string; skin?: string }) => (
  <g transform={`translate(${x} ${y})`}>
    <circle cx="0" cy="-8" r="7" fill={skin} />
    <path d="M-12 14c0-10 5-16 12-16s12 6 12 16Z" fill={c} />
  </g>
);

export const ART = {
  apply: (
    <Svg>
      <Sun x={122} y={30} />
      <path d="M0 98C30 88 55 104 90 96s50-8 70-2V120H0Z" fill={T} opacity=".35" />
      <g transform="rotate(-8 62 66)">
        <rect x="36" y="26" width="58" height="76" rx="8" fill={N} />
        <rect x="36" y="26" width="58" height="76" rx="8" fill="none" stroke={B} strokeWidth="2" />
        <circle cx="65" cy="58" r="16" fill="none" stroke={G} strokeWidth="2.5" />
        <path d="M49 58h32M65 42c-8 8-8 24 0 32 8-8 8-24 0-32Z" stroke={G} strokeWidth="2" fill="none" />
        <rect x="48" y="84" width="34" height="4" rx="2" fill={G} />
      </g>
      <circle cx="98" cy="86" r="17" fill={W} />
      <circle cx="98" cy="86" r="14" fill={T} />
      <path d="M91 86l5 5 9-10" stroke={W} strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Plane x={26} y={28} s={1.1} c={B} r={-20} />
      <path d="M8 44c10-4 16-2 20-6" stroke={B} strokeWidth="1.8" strokeDasharray="3 4" fill="none" strokeLinecap="round" />
      <Spark x={142} y={70} s={1} />
      <Spark x={20} y={86} s={0.7} c={L} />
    </Svg>
  ),
  check: (
    <Svg>
      <circle cx="66" cy="58" r="34" fill={T} />
      <path d="M32 58h68M66 24c-18 18-18 50 0 68M66 24c18 18 18 50 0 68M38 42h56M38 74h56" stroke={M} strokeWidth="2.2" fill="none" opacity=".85" />
      <circle cx="90" cy="48" r="26" fill={W} fillOpacity=".55" stroke={N} strokeWidth="5" />
      <path d="M108 68l22 24" stroke={N} strokeWidth="9" strokeLinecap="round" />
      <path d="M79 49l8 8 14-16" stroke={B} strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Spark x={30} y={24} s={1} />
      <Spark x={138} y={30} s={0.7} c={L} />
    </Svg>
  ),
  trips: (
    <Svg>
      <rect x="20" y="28" width="100" height="58" rx="10" fill={W} stroke={B} strokeWidth="3" />
      <path d="M92 28v58" stroke={B} strokeWidth="2.5" strokeDasharray="4 4" />
      <circle cx="92" cy="28" r="6" fill="#FFE3EE" />
      <circle cx="92" cy="86" r="6" fill="#FFE3EE" />
      <rect x="30" y="40" width="38" height="7" rx="3.5" fill={N} />
      <rect x="30" y="54" width="26" height="5" rx="2.5" fill={T} />
      <rect x="30" y="66" width="46" height="5" rx="2.5" fill={S} />
      <Plane x={106} y={57} s={0.9} c={L} r={-10} />
      <circle cx="40" cy="104" r="6" fill={T} />
      <circle cx="62" cy="104" r="6" fill={T} />
      <circle cx="84" cy="104" r="6" fill={G} />
      <circle cx="106" cy="104" r="6" fill={W} stroke={B} strokeWidth="2" />
      <path d="M46 104h10M68 104h10M90 104h10" stroke={T} strokeWidth="2.5" />
      <Spark x={136} y={34} s={0.9} />
    </Svg>
  ),
  travelers: (
    <Svg>
      <rect x="14" y="40" width="70" height="46" rx="8" fill={W} stroke={B} strokeWidth="3" transform="rotate(-6 49 63)" />
      <rect x="62" y="34" width="70" height="46" rx="8" fill={S} stroke={T} strokeWidth="3" transform="rotate(5 97 57)" />
      <g transform="rotate(-6 49 63)">
        <Person x={34} y={66} c={L} />
        <rect x="52" y="52" width="24" height="5" rx="2.5" fill={N} />
        <rect x="52" y="63" width="18" height="4" rx="2" fill={T} />
      </g>
      <g transform="rotate(5 97 57)">
        <Person x={82} y={60} c={B} skin="#C98F65" />
        <rect x="100" y="46" width="24" height="5" rx="2.5" fill={N} />
        <rect x="100" y="57" width="18" height="4" rx="2" fill={B} />
      </g>
      <circle cx="132" cy="92" r="14" fill={G} />
      <path d="M132 85v14M125 92h14" stroke={W} strokeWidth="4" strokeLinecap="round" />
    </Svg>
  ),
  extras: (
    <Svg>
      <path d="M44 48h60l6 54a6 6 0 0 1-6 6H44a6 6 0 0 1-6-6Z" fill={T} />
      <path d="M58 48V38a16 16 0 0 1 32 0v10" fill="none" stroke={TD} strokeWidth="6" strokeLinecap="round" />
      <rect x="62" y="64" width="24" height="26" rx="6" fill={W} />
      <path d="M74 70v14M67 77h14" stroke={T} strokeWidth="5" strokeLinecap="round" />
      <path d="M118 22l6 6 12-12" stroke="none" />
      <path d="M112 40c10 4 14 12 14 20" stroke={GL} strokeWidth="0" />
      <g transform="translate(116 28)">
        <path d="M0-14l14 5v10c0 9-6 15-14 18-8-3-14-9-14-18v-10Z" fill={B} />
        <path d="M-6 0l5 5 8-9" stroke={W} strokeWidth="3.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g transform="translate(24 36) rotate(-12)">
        <path d="M0 0h18l8 8v22H0Z" fill={G} />
        <rect x="6" y="12" width="14" height="12" rx="2" fill={W} opacity=".9" />
        <path d="M6 18h14M13 12v12" stroke={G} strokeWidth="1.5" />
      </g>
      <Plane x={128} y={86} s={0.8} c={L} r={-30} />
      <Spark x={26} y={96} s={0.8} c={L} />
      <Spark x={92} y={16} s={0.9} />
    </Svg>
  ),
  guide: (
    <Svg>
      <path d="M0 96h160v24H0Z" fill={S} />
      <path d="M0 96h160" stroke={B} strokeWidth="2" />
      <rect x="22" y="26" width="76" height="30" rx="8" fill={N} />
      <path d="M32 41h40M62 33l10 8-10 8" stroke={G} strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <text x="80" y="46" fontSize="14" fontWeight="800" fill={W} fontFamily="sans-serif">D5</text>
      <rect x="58" y="56" width="5" height="40" fill={N} />
      <Plane x={126} y={40} s={1.3} c={B} r={-25} />
      <path d="M104 62c10-2 16-8 22-14" stroke={B} strokeWidth="1.8" strokeDasharray="3 4" fill="none" strokeLinecap="round" />
      <rect x="112" y="76" width="26" height="22" rx="5" fill={L} />
      <path d="M120 76v-5a5 5 0 0 1 10 0v5" fill="none" stroke={N} strokeWidth="3" />
      <circle cx="120" cy="100" r="3" fill={N} />
      <circle cx="132" cy="100" r="3" fill={N} />
      <Spark x={32} y={80} s={0.8} />
    </Svg>
  ),
  help: (
    <Svg>
      <path d="M22 28h66a10 10 0 0 1 10 10v28a10 10 0 0 1-10 10H54L38 92V76H22a10 10 0 0 1-10-10V38a10 10 0 0 1 10-10Z" fill={B} />
      <circle cx="42" cy="52" r="4" fill={W} />
      <circle cx="68" cy="52" r="4" fill={W} />
      <path d="M44 62q10 8 22 0" stroke={W} strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <g transform="translate(98 56)">
        <rect x="0" y="6" width="44" height="36" rx="12" fill={T} />
        <rect x="8" y="14" width="28" height="20" rx="8" fill={W} />
        <circle cx="17" cy="24" r="3" fill={N} />
        <circle cx="27" cy="24" r="3" fill={N} />
        <path d="M22 6V-2" stroke={TD} strokeWidth="3" strokeLinecap="round" />
        <circle cx="22" cy="-4" r="4" fill={G} />
      </g>
      <Spark x={122} y={26} s={0.9} />
      <Spark x={146} y={100} s={0.6} c={L} />
    </Svg>
  ),
  ai: (
    <Svg>
      <rect x="40" y="30" width="64" height="64" rx="14" fill={B} />
      <rect x="52" y="42" width="40" height="40" rx="8" fill={W} />
      <path d="M62 72V54l10 12 10-12v18" stroke={N} strokeWidth="4.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {[48, 62, 76, 90].map((x) => (<g key={x}><rect x={x - 2} y="20" width="4" height="10" rx="2" fill={T} /><rect x={x - 2} y="94" width="4" height="10" rx="2" fill={T} /></g>))}
      {[44, 58, 72, 86].map((y) => (<g key={y}><rect x="30" y={y - 2} width="10" height="4" rx="2" fill={T} /><rect x="104" y={y - 2} width="10" height="4" rx="2" fill={T} /></g>))}
      <circle cx="126" cy="38" r="14" fill={G} />
      <path d="M126 29l2.6 6.4 6.4 2.6-6.4 2.6-2.6 6.4-2.6-6.4-6.4-2.6 6.4-2.6Z" fill={W} />
      <Spark x={22} y={26} s={0.9} c={L} />
      <Spark x={134} y={88} s={0.7} />
    </Svg>
  ),
  prompts: (
    <Svg>
      <rect x="26" y="12" width="76" height="96" rx="9" fill={W} stroke={B} strokeWidth="3" />
      <rect x="38" y="26" width="32" height="7" rx="3.5" fill={G} />
      {[44, 58, 72, 86].map((y, i) => (<g key={y}><path d={`M40 ${y + 3}l4 4 7-8`} stroke={T} strokeWidth="3.2" fill="none" strokeLinecap="round" strokeLinejoin="round" /><rect x="58" y={y} width={34 - i * 5} height="6" rx="3" fill={N} opacity="0.8" /></g>))}
      <g transform="rotate(38 118 66)">
        <rect x="108" y="30" width="16" height="64" rx="4" fill={L} />
        <rect x="108" y="30" width="16" height="12" rx="4" fill={N} />
        <path d="M108 94h16l-8 16Z" fill={GL} />
        <path d="M114 106h4l-2 4Z" fill={N} />
      </g>
      <Spark x={134} y={26} s={0.9} />
      <Spark x={16} y={96} s={0.7} c={L} />
    </Svg>
  ),
  fees: (
    <Svg>
      <path d="M32 14h60v86l-8-6-8 6-8-6-8 6-8-6-8 6-8-6-4 4Z" fill={W} stroke={B} strokeWidth="3" strokeLinejoin="round" />
      <rect x="42" y="28" width="30" height="6" rx="3" fill={N} />
      <rect x="42" y="42" width="40" height="5" rx="2.5" fill={S} />
      <rect x="42" y="54" width="40" height="5" rx="2.5" fill={S} />
      <rect x="42" y="66" width="24" height="5" rx="2.5" fill={T} />
      <g transform="translate(112 74)">
        <ellipse cx="0" cy="12" rx="20" ry="8" fill={G} />
        <ellipse cx="0" cy="6" rx="20" ry="8" fill={GL} />
        <ellipse cx="0" cy="0" rx="20" ry="8" fill={G} />
        <text x="-6" y="5" fontSize="13" fontWeight="800" fill={N} fontFamily="sans-serif">฿</text>
      </g>
      <circle cx="122" cy="34" r="14" fill={T} />
      <path d="M115 34l5 5 9-10" stroke={W} strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Spark x={22} y={104} s={0.8} c={L} />
    </Svg>
  ),
  pass: (
    <Svg>
      <rect x="44" y="10" width="66" height="104" rx="12" fill={N} />
      <rect x="49" y="20" width="56" height="84" rx="7" fill={W} />
      <rect x="49" y="20" width="56" height="20" rx="7" fill={T} />
      <rect x="49" y="32" width="56" height="8" fill={T} />
      <rect x="56" y="26" width="26" height="5" rx="2.5" fill={W} />
      <g fill={N}>
        <rect x="58" y="50" width="12" height="12" rx="2" />
        <rect x="84" y="50" width="12" height="12" rx="2" />
        <rect x="58" y="76" width="12" height="12" rx="2" />
        <rect x="76" y="68" width="5" height="5" />
        <rect x="84" y="76" width="5" height="5" />
        <rect x="90" y="84" width="5" height="5" />
        <rect x="74" y="56" width="5" height="5" />
        <rect x="76" y="82" width="5" height="5" />
      </g>
      <circle cx="108" cy="92" r="16" fill={G} />
      <path d="M101 92l5 5 9-10" stroke={N} strokeWidth="3.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Spark x={22} y={36} s={1} />
      <Spark x={138} y={30} s={0.7} c={L} />
    </Svg>
  ),
  notifications: (
    <Svg>
      <path d="M80 20c-20 0-30 14-30 34v14l-10 14h80L110 68V54c0-20-10-34-30-34Z" fill={G} />
      <path d="M62 38c4-8 10-12 18-12" stroke={W} strokeWidth="4" strokeLinecap="round" fill="none" opacity=".7" />
      <path d="M70 90a10 10 0 0 0 20 0Z" fill={N} />
      <circle cx="80" cy="14" r="5" fill={N} />
      <circle cx="108" cy="30" r="12" fill={L} />
      <text x="104" y="35" fontSize="14" fontWeight="800" fill={W} fontFamily="sans-serif">1</text>
      <path d="M32 50c-6 6-6 14 0 20M24 44c-10 10-10 26 0 36M128 50c6 6 6 14 0 20M136 44c10 10 10 26 0 36" stroke={T} strokeWidth="3" strokeLinecap="round" fill="none" />
    </Svg>
  ),
  account: (
    <Svg>
      <rect x="22" y="26" width="88" height="62" rx="10" fill={W} stroke={B} strokeWidth="3" />
      <circle cx="52" cy="54" r="12" fill="#F4C7A1" />
      <path d="M32 82c0-12 9-18 20-18s20 6 20 18Z" fill={B} />
      <rect x="78" y="42" width="24" height="6" rx="3" fill={N} />
      <rect x="78" y="54" width="18" height="5" rx="2.5" fill={T} />
      <rect x="78" y="66" width="22" height="5" rx="2.5" fill={S} />
      <g transform="translate(116 80)">
        <path d="M0-16l16 6v12c0 10-7 17-16 20-9-3-16-10-16-20v-12Z" fill={T} />
        <path d="M-7 0l6 6 10-11" stroke={W} strokeWidth="3.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <Spark x={132} y={30} s={0.9} />
    </Svg>
  ),
  ops: (
    <Svg>
      <rect x="34" y="18" width="70" height="92" rx="9" fill={W} stroke={B} strokeWidth="3" />
      <rect x="54" y="12" width="30" height="14" rx="6" fill={B} />
      {[38, 58, 78].map((y, i) => (
        <g key={y}>
          <rect x="44" y={y} width="12" height="12" rx="3" fill={i < 2 ? T : G} />
          {i < 2 && <path d={`M47 ${y + 6}l3 3 5-6`} stroke={W} strokeWidth="2" fill="none" strokeLinecap="round" />}
          <rect x="62" y={y + 1} width="32" height="4" rx="2" fill={N} />
          <rect x="62" y={y + 8} width="22" height="3" rx="1.5" fill={S} />
        </g>
      ))}
      <circle cx="116" cy="82" r="16" fill={W} fillOpacity=".6" stroke={N} strokeWidth="4.5" />
      <path d="M128 94l14 14" stroke={N} strokeWidth="6" strokeLinecap="round" />
      <Spark x={130} y={30} s={0.9} />
    </Svg>
  ),
  branding: (
    <Svg>
      <path d="M72 18c-30 0-52 20-52 44 0 22 18 40 40 40 8 0 12-5 10-12-2-6 2-12 10-12h20c14 0 24-8 24-22 0-20-22-38-52-38Z" fill={S} stroke={B} strokeWidth="3" />
      <circle cx="46" cy="52" r="8" fill={T} />
      <circle cx="68" cy="38" r="8" fill={G} />
      <circle cx="92" cy="44" r="8" fill={L} />
      <circle cx="104" cy="64" r="8" fill={B} />
      <path d="M118 26l20-12 6 10-20 14Z" fill={N} />
      <path d="M104 40l14 4-8 12c-4 6-12 4-14-2Z" fill={G} />
    </Svg>
  ),
  features: (
    <Svg>
      {[30, 58, 86].map((y, i) => (
        <g key={y}>
          <rect x="30" y={y} width="76" height="22" rx="11" fill={i === 1 ? "#C9D3E3" : T} />
          <circle cx={i === 1 ? 41 : 95} cy={y + 11} r="8" fill={W} />
          <rect x="114" y={y + 6} width="22" height="5" rx="2.5" fill={N} opacity=".7" />
        </g>
      ))}
      <Spark x={130} y={26} s={1} />
    </Svg>
  ),
  admins: (
    <Svg>
      <path d="M70 12l38 14v28c0 24-16 40-38 50-22-10-38-26-38-50V26Z" fill={B} />
      <circle cx="70" cy="46" r="11" fill="#F4C7A1" />
      <path d="M50 78c0-14 9-20 20-20s20 6 20 20Z" fill={W} />
      <g transform="translate(118 84)">
        <circle cx="0" cy="0" r="10" fill={G} />
        <circle cx="0" cy="0" r="4" fill={N} />
        <path d="M8 6l22 14M22 14l0 8M28 18l0 8" stroke={G} strokeWidth="5" strokeLinecap="round" />
      </g>
      <Spark x={24} y={22} s={0.8} />
    </Svg>
  ),
  audit: (
    <Svg>
      <rect x="28" y="14" width="76" height="94" rx="9" fill={W} stroke={B} strokeWidth="3" />
      {[30, 46, 62, 78].map((y, i) => (
        <g key={y}>
          <circle cx="42" cy={y + 3} r="4" fill={i === 0 ? G : T} />
          <rect x="52" y={y} width={38 - i * 4} height="6" rx="3" fill={N} opacity={0.85 - i * 0.12} />
        </g>
      ))}
      <circle cx="112" cy="84" r="22" fill={W} stroke={N} strokeWidth="4" />
      <path d="M112 70v15l10 6" stroke={N} strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="112" cy="84" r="22" fill="none" stroke={G} strokeWidth="2" strokeDasharray="4 5" />
    </Svg>
  ),
  analytics: (
    <Svg>
      <rect x="22" y="14" width="102" height="86" rx="10" fill={W} stroke={B} strokeWidth="3" />
      <rect x="36" y="64" width="14" height="26" rx="3" fill={T} />
      <rect x="58" y="50" width="14" height="40" rx="3" fill={B} />
      <rect x="80" y="36" width="14" height="54" rx="3" fill={G} />
      <rect x="102" y="26" width="14" height="64" rx="3" fill={L} />
      <path d="M32 58l26-18 22-4 34-20" stroke={N} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1 7" />
      <path d="M122 14l8 2-6 6Z" fill={N} transform="translate(8 -2)" />
    </Svg>
  ),
  settings: (
    <Svg>
      <g transform="translate(70 62)">
        <path
          d="M-8-40h16l3 10 8 4 10-5 11 11-5 10 4 8 10 3v16l-10 3-4 8 5 10-11 11-10-5-8 4-3 10h-16l-3-10-8-4-10 5-11-11 5-10-4-8-10-3v-16l10-3 4-8-5-10 11-11 10 5 8-4Z"
          fill={T}
        />
        <circle r="17" fill={W} />
        <circle r="8" fill={G} />
      </g>
      <g transform="translate(124 30)">
        <rect x="-18" y="-4" width="36" height="8" rx="4" fill={N} />
        <circle cx="6" cy="0" r="9" fill={G} />
      </g>
      <g transform="translate(124 88)">
        <rect x="-18" y="-4" width="36" height="8" rx="4" fill={N} />
        <circle cx="-8" cy="0" r="9" fill={L} />
      </g>
    </Svg>
  ),
} satisfies Record<string, ReactNode>;

export type ArtName = keyof typeof ART;

/**
 * Banner for the home greeting card: a warm Thai sunrise with Wat Arun, a golden chedi with a Thai roof, palms, a long-tail boat with ribbons,
 * lotus flowers and the brand's paper plane. The left side is kept calm (soft sky and sea) because the card puts a white veil there for the text.
 */
export function HeroThailand() {
  const tier = (cx: number, y: number, w: number, h: number, c: string, c2: string) => (
    <g key={`${cx}-${y}`}>
      <path d={`M${cx - w / 2} ${y + h}L${cx - w / 2 + 3} ${y}H${cx + w / 2 - 3}L${cx + w / 2} ${y + h}Z`} fill={c} />
      <rect x={cx - w / 2 + 4} y={y + 2} width={w - 8} height="2.4" fill={c2} />
    </g>
  );
  const prang = (cx: number, base: number, s: number, c: string, c2: string, c3: string) => (
    <g transform={`translate(${cx} ${base}) scale(${s})`}>
      {tier(0, -14, 34, 14, c, c3)}
      {tier(0, -28, 26, 14, c2, G)}
      {tier(0, -42, 19, 14, c, c3)}
      <path d="M-7 -42C-7 -58 -3 -68 0 -80 3 -68 7 -58 7 -42Z" fill={c2} />
      <path d="M-4 -46C-4 -58 -2 -66 0 -74 2 -66 4 -58 4 -46Z" fill={c} />
      <circle cx="0" cy="-34" r="2.2" fill={L} /><circle cx="-9" cy="-20" r="2" fill={T} /><circle cx="9" cy="-20" r="2" fill={T} />
      <rect x="-0.8" y="-92" width="1.6" height="12" fill={G} /><circle cx="0" cy="-93" r="2.2" fill={G} />
    </g>
  );
  const palm = (x: number, y: number, s: number) => (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M0 0C2-14 1-28-3-42" stroke={TD} strokeWidth="3" strokeLinecap="round" fill="none" />
      {[[-30, -34], [-22, -52], [-3, -58], [18, -50], [28, -34]].map(([dx, dy], i) => <path key={i} d={`M-3 -42Q${dx / 2 - 3} ${dy - 8} ${dx - 3} ${dy + 6}Q${dx / 2 - 2} ${dy + 2} -3 -42Z`} fill={i % 2 ? T : TD} />)}
      <circle cx="-3" cy="-41" r="2.6" fill={G} />
    </g>
  );
  const lotus = (x: number, y: number, s: number) => (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M0 0C-12 -2-14 -14 -8 -20-2 -14 0 -8 0 0Z" fill={L} /><path d="M0 0C12 -2 14 -14 8 -20 2 -14 0 -8 0 0Z" fill={L} />
      <path d="M0 0C-7 -4-6 -18 0 -26 6 -18 7 -4 0 0Z" fill="#FF86AE" /><circle cx="0" cy="-8" r="2.2" fill={G} />
      <ellipse cx="0" cy="3" rx="16" ry="3.5" fill={TD} opacity=".55" />
    </g>
  );
  return (
    <svg viewBox="0 0 400 170" preserveAspectRatio="xMaxYMax slice" className="h-full w-full" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="hs-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFF1B0" /><stop offset=".45" stopColor="#FFC970" /><stop offset=".8" stopColor="#FF9DB0" /><stop offset="1" stopColor="#FFB7C9" /></linearGradient>
        <linearGradient id="hs-sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#19C3B9" /><stop offset="1" stopColor="#1557E0" /></linearGradient>
        <radialGradient id="hs-sun" cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#FFF6C9" /><stop offset=".55" stopColor="#FFC93C" stopOpacity=".95" /><stop offset="1" stopColor="#FFB627" stopOpacity="0" /></radialGradient>
      </defs>
      <rect width="400" height="170" fill="url(#hs-sky)" />
      <circle cx="292" cy="104" r="78" fill="url(#hs-sun)" />
      <circle cx="292" cy="104" r="30" fill={G} />
      {/* clouds */}
      <g fill={W} opacity=".75"><ellipse cx="150" cy="30" rx="26" ry="7" /><ellipse cx="168" cy="26" rx="16" ry="7" /><ellipse cx="368" cy="26" rx="22" ry="6" /><ellipse cx="382" cy="22" rx="12" ry="6" /></g>
      {/* far hills */}
      <path d="M0 126C40 112 80 120 120 114 170 106 200 122 250 116 310 108 360 120 400 112V150H0Z" fill="#7FD6C7" opacity=".7" />
      {/* golden chedi with a Thai roof, far right */}
      <g transform="translate(366 128)">
        <path d="M-14 0Q-14-16 0-18 14-16 14 0Z" fill={G} /><rect x="-16" y="-3" width="32" height="4" fill="#E08A00" />
        <path d="M-6 -17H6L3 -32H-3Z" fill={GL} /><path d="M-1.5 -32H1.5L0 -48Z" fill={G} />
        <path d="M-22 -2L-8 -12 8 -12 22 -2Z" fill="#E5233B" opacity=".0" />
      </g>
      <g transform="translate(340 130)">
        <path d="M-26 0L-20 -14H20L26 0Z" fill="#E5233B" /><path d="M-18 -14L-12 -26H12L18 -14Z" fill={G} /><path d="M-10 -26L-5 -36H5L10 -26Z" fill={T} />
        <path d="M-27 1L-26 -2H26L27 1Z" fill="#8A5A00" /><rect x="-16" y="0" width="32" height="12" fill={W} /><rect x="-3" y="3" width="6" height="9" fill="#1B3D8F" />
      </g>
      {/* Wat Arun */}
      {prang(240, 132, 0.52, "#E9805B", "#FFD36B", W)}
      {prang(334, 138, 0.4, "#E9805B", "#FFD36B", W)}
      {prang(292, 134, 1, "#FFFFFF", "#7C6CF0", "#FFB627")}
      <rect x="262" y="124" width="60" height="12" fill="#FFF3D6" /><rect x="262" y="124" width="60" height="2.6" fill={G} />
      {/* palms */}
      {palm(212, 138, 0.9)}{palm(396, 140, 1.05)}
      {/* sea */}
      <path d="M0 136C30 130 60 142 100 136 150 128 190 142 240 136 290 130 340 142 400 134V170H0Z" fill="url(#hs-sea)" />
      <path d="M0 148C40 142 80 154 130 148 180 142 230 154 290 148 340 143 370 150 400 146V170H0Z" fill="#0F46B8" opacity=".55" />
      <g fill="none" stroke={W} strokeWidth="1.6" strokeLinecap="round" opacity=".7"><path d="M26 142q6-4 12 0M60 150q6-4 12 0M118 144q6-4 12 0M170 152q6-4 12 0M250 146q6-4 12 0M330 152q6-4 12 0" /></g>
      {/* long-tail boat with ribbons */}
      <g transform="translate(168 142)">
        <path d="M-34 -2Q-30 8 -14 9H26Q40 8 46 -12 36 -2 22 -2Z" fill="#1B3D8F" /><path d="M-34 -2Q-38 -12 -46 -18 -32 -14 -22 -2Z" fill={L} />
        <path d="M-34 -2H22" stroke={G} strokeWidth="2.4" />
        <path d="M-6 -2V-18" stroke={N} strokeWidth="1.6" /><path d="M-12 -18Q-6 -26 0 -18Z" fill={T} />
        <path d="M46 -12L74 -4" stroke={N} strokeWidth="2.2" strokeLinecap="round" /><circle cx="76" cy="-3" r="2.6" fill={N} />
        <path d="M-46 -18Q-52 -12 -49 -4M-46 -18Q-56 -16 -57 -8M-46 -18Q-50 -22 -56 -20" stroke={G} strokeWidth="1.4" fill="none" strokeLinecap="round" /><circle cx="-49" cy="-3" r="1.6" fill={L} /><circle cx="-57" cy="-7" r="1.6" fill={T} /><circle cx="-56" cy="-19" r="1.6" fill={G} />
      </g>
      {/* lotus in the corner and paper plane */}
      {lotus(350, 160, 0.9)}{lotus(380, 164, 0.7)}{lotus(120, 164, 0.6)}
      <g transform="translate(112 44) rotate(-12)"><path d="M-22 4 22-12c3-1 4 2 1 4L8 8 4 22c-1 3-4 3-4 0L-2 10-16 8c-3-1-3-3 0-4Z" fill={B} /><path d="M8 8 22-12-2 10Z" fill="#0F46B8" /></g>
      <path d="M44 66C64 70 84 60 98 54" stroke={B} strokeWidth="1.6" strokeDasharray="4 4" fill="none" strokeLinecap="round" opacity=".7" />
      <Spark x={196} y={52} s={0.8} /><Spark x={60} y={34} s={0.6} c={L} /><Spark x={252} y={34} s={0.7} />
    </svg>
  );
}
