import type { ScoredResort } from "@/lib/scoring/score";

function oneDecimal(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function signed(n: number): string {
  const text = oneDecimal(n);
  return n > 0 ? `+${text}` : text;
}

export function ScoreBreakdown({ result }: { result: ScoredResort }) {
  return (
    <table className="ski-mono mt-2 w-full text-left text-xs text-[#0b1d33]">
      <thead>
        <tr className="text-[#3a566f]">
          <th className="py-1 pr-3 font-normal tracking-[0.06em]">FACTOR</th>
          <th className="py-1 pr-3 font-normal tracking-[0.06em]">RAW</th>
          <th className="py-1 pr-3 text-right font-normal tracking-[0.06em]">SCORE</th>
          <th className="py-1 pr-3 text-right font-normal tracking-[0.06em]">WT</th>
          <th className="py-1 text-right font-normal tracking-[0.06em]">PTS</th>
        </tr>
      </thead>
      <tbody>
        {result.factors.map((factor) => (
          <tr key={factor.key} className="border-t border-[#d6eaf7]">
            <td className="py-1.5 pr-3">{factor.label}</td>
            <td className="py-1.5 pr-3 text-[#3a566f]">{factor.raw}</td>
            <td className="py-1.5 pr-3 text-right whitespace-nowrap">{oneDecimal(factor.score)}</td>
            <td className="py-1.5 pr-3 text-right whitespace-nowrap">{factor.weight}</td>
            <td className="py-1.5 text-right whitespace-nowrap">{oneDecimal(factor.weighted)}</td>
          </tr>
        ))}
        {result.adjustments.map((adjustment) => (
          <tr key={adjustment.label} className="border-t border-[#d6eaf7]">
            <td className="py-1.5" colSpan={4}>
              {adjustment.label}
            </td>
            <td className="py-1.5 text-right">{signed(adjustment.points)}</td>
          </tr>
        ))}
        <tr className="border-t border-[#d6eaf7]">
          <td className="py-1.5 font-semibold" colSpan={4}>
            Mountain score
          </td>
          <td className="py-1.5 text-right font-semibold">{Math.round(result.rawScore)}</td>
        </tr>
        <tr className="border-t border-[#d6eaf7]">
          <td className="py-1.5 font-semibold" colSpan={4}>
            Final score
          </td>
          <td className="py-1.5 text-right font-semibold">{Math.round(result.finalScore)}</td>
        </tr>
      </tbody>
    </table>
  );
}
