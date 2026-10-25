import type { ScoredResort } from "@/lib/scoring/score";

const mono = "font-[ui-monospace,SFMono-Regular,Menlo,monospace] tabular-nums";

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
    <table className="mt-2 w-full text-left text-xs">
      <thead>
        <tr className="text-muted-foreground">
          <th className="py-1 font-medium">Factor</th>
          <th className="py-1 font-medium">Raw</th>
          <th className={`py-1 text-right font-medium ${mono}`}>Score</th>
          <th className={`py-1 text-right font-medium ${mono}`}>Wt</th>
          <th className={`py-1 text-right font-medium ${mono}`}>Pts</th>
        </tr>
      </thead>
      <tbody>
        {result.factors.map((factor) => (
          <tr key={factor.key} className="border-t">
            <td className="py-1.5 pr-2">{factor.label}</td>
            <td className="py-1.5 pr-2 text-muted-foreground">{factor.raw}</td>
            <td className={`py-1.5 text-right ${mono}`}>{oneDecimal(factor.score)}</td>
            <td className={`py-1.5 text-right ${mono}`}>{factor.weight}</td>
            <td className={`py-1.5 text-right ${mono}`}>{oneDecimal(factor.weighted)}</td>
          </tr>
        ))}
        {result.adjustments.map((adjustment) => (
          <tr key={adjustment.label} className="border-t">
            <td className="py-1.5" colSpan={4}>
              {adjustment.label}
            </td>
            <td className={`py-1.5 text-right ${mono}`}>{signed(adjustment.points)}</td>
          </tr>
        ))}
        <tr className="border-t">
          <td className="py-1.5 font-medium" colSpan={4}>
            Mountain score
          </td>
          <td className={`py-1.5 text-right font-medium ${mono}`}>{Math.round(result.rawScore)}</td>
        </tr>
        <tr className="border-t">
          <td className="py-1.5 font-medium" colSpan={4}>
            Final score
          </td>
          <td className={`py-1.5 text-right font-medium ${mono}`}>{Math.round(result.finalScore)}</td>
        </tr>
      </tbody>
    </table>
  );
}
