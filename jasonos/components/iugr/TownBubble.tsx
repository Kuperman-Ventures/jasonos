type TownBubbleProps = {
  className?: string;
};

/** Compact illustrated town specimen for the opening stage — inline SVG only. */
export function TownBubble({ className = "iugr-town-bubble" }: TownBubbleProps) {
  return (
    <div className={className} aria-hidden>
      <svg viewBox="0 0 220 160" className="iugr-town-bubble-svg" role="presentation">
        <defs>
          <radialGradient id="iugr-bubble-glow" cx="50%" cy="45%" r="55%">
            <stop offset="0%" stopColor="#c6e355" stopOpacity="0.22" />
            <stop offset="55%" stopColor="#8b7cc9" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#070b16" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="110" cy="80" r="72" fill="url(#iugr-bubble-glow)" />
        <circle
          cx="110"
          cy="80"
          r="68"
          fill="none"
          stroke="rgba(243,234,215,0.22)"
          strokeWidth="1.2"
        />
        {/* Soft ground */}
        <ellipse cx="110" cy="118" rx="48" ry="10" fill="#1a2740" />
        {/* Bakery */}
        <rect x="78" y="86" width="28" height="22" rx="3" fill="#2a3550" stroke="#cbbfa8" strokeWidth="0.8" />
        <path d="M74 88h36l-6-10H80z" fill="#e0897a" />
        <rect x="88" y="94" width="8" height="8" rx="1" fill="#c6e355" opacity="0.85" />
        {/* Homes */}
        <rect x="118" y="92" width="18" height="16" rx="2" fill="#24324c" stroke="#cbbfa8" strokeWidth="0.7" />
        <path d="M116 93h22l-5-8h-12z" fill="#8b7cc9" />
        <rect x="58" y="96" width="16" height="14" rx="2" fill="#24324c" stroke="#cbbfa8" strokeWidth="0.7" />
        <path d="M56 97h20l-4-7H60z" fill="#c6e355" opacity="0.7" />
        {/* Town hall / fountain */}
        <circle cx="110" cy="112" r="4" fill="#8b7cc9" opacity="0.7" />
        <rect x="108.5" y="104" width="3" height="8" fill="#cbbfa8" />
        {/* Trees */}
        <circle cx="50" cy="104" r="7" fill="#2f5d45" />
        <rect x="48.5" y="108" width="3" height="8" fill="#5a4634" />
        <circle cx="160" cy="106" r="8" fill="#2f5d45" />
        <rect x="158.5" y="110" width="3" height="8" fill="#5a4634" />
        {/* Tiny residents */}
        <circle cx="96" cy="112" r="2.2" fill="#f3ead7" />
        <circle cx="124" cy="112" r="2.2" fill="#f3ead7" />
        <circle cx="70" cy="114" r="2" fill="#c6e355" />
      </svg>
    </div>
  );
}
