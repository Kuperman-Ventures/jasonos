export function GatedBanner({ reasons }: { reasons: string[] }) {
  return (
    <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-900">
      {reasons.map((reason) => (
        <p key={reason}>{reason}</p>
      ))}
    </div>
  );
}
