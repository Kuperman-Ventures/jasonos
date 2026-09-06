import { Plate } from "@/components/iugr/plate/Plate";

type TownBubbleProps = {
  className?: string;
};

/**
 * Opening specimen — same line-art town as Original Town, inside a Plate.
 * Stroke only. No coloured cartoon fills.
 */
export function TownBubble({ className = "iugr-town-bubble" }: TownBubbleProps) {
  return (
    <div className={className}>
      <Plate figureNumber={1} caption="Original Town.">
        <svg
          className="iugr-town-sketch"
          viewBox="0 0 280 78"
          aria-hidden
          role="presentation"
        >
          <path className="iugr-town-sketch-stroke" d="M18 62 H262" />
          <path className="iugr-town-sketch-stroke" d="M36 62 V40 H70 V62" />
          <path className="iugr-town-sketch-stroke" d="M32 40 L53 22 L74 40" />
          <path className="iugr-town-sketch-stroke" d="M46 62 V50 H60 V62" />
          <path className="iugr-town-sketch-stroke" d="M108 62 V28 H172 V62" />
          <path className="iugr-town-sketch-stroke" d="M102 28 L140 8 L178 28" />
          <rect
            className="iugr-town-sketch-stroke"
            x="132"
            y="44"
            width="16"
            height="18"
          />
          <path className="iugr-town-sketch-stroke" d="M198 62 V44 H232 V62" />
          <path className="iugr-town-sketch-stroke" d="M194 44 L215 28 L236 44" />
        </svg>
      </Plate>
    </div>
  );
}
