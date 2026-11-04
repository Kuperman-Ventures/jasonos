"use client";

import Link from "next/link";
import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { etYmd } from "@/lib/dates";
import { weekEyebrow, type WebinarRange } from "@/lib/webinars/display";
import { topicStyle } from "@/lib/webinars/topic-style";

const RANGES: Array<{ id: WebinarRange; label: string; href: string }> = [
  { id: "week", label: "This week", href: "/webinars?range=week" },
  { id: "4w", label: "4 weeks", href: "/webinars?range=4w" },
  { id: "all", label: "All", href: "/webinars?range=all" },
];

const ZERO_CHIP_LIMIT = 5;

type Chip = { slug: string; name: string; count: number };

export function PageHeader({
  range,
  chips,
  sessions,
  takeaways,
  actions,
  candidates,
  scanning,
  onRescan,
}: {
  range: WebinarRange;
  chips: Chip[];
  sessions: number;
  takeaways: number;
  actions: number;
  candidates: number;
  scanning: boolean;
  onRescan: () => void;
}) {
  const [showAllZeros, setShowAllZeros] = useState(false);
  let zeros = 0;
  const hidden: Chip[] = [];
  const visible: Chip[] = [];
  for (const chip of chips) {
    if (chip.count === 0) {
      zeros += 1;
      if (!showAllZeros && zeros > ZERO_CHIP_LIMIT) {
        hidden.push(chip);
        continue;
      }
    }
    visible.push(chip);
  }

  return (
    <header>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[#7d7979]">
            {weekEyebrow(range, etYmd())}
          </p>
          <h1 className="mt-1 text-[32px] font-semibold leading-none text-[#201e1d]">Webinars</h1>
          <Link
            href="/webinars/topics"
            className="mt-2 inline-block text-[13px] text-[#7d7979] underline-offset-2 hover:underline"
          >
            Manage topics
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-2 max-[720px]:basis-full">
          <div
            className="inline-flex overflow-hidden rounded-[6px] border border-[rgba(32,30,29,0.10)] bg-[#ffffff]"
            role="group"
            aria-label="Date range"
          >
            {RANGES.map((option) => {
              const selected = option.id === range;
              return (
                <Link
                  key={option.id}
                  href={option.href}
                  aria-current={selected ? "page" : undefined}
                  className={
                    selected
                      ? "bg-[#201e1d] px-3 py-1.5 text-[13px] text-[#ffffff]"
                      : "px-3 py-1.5 text-[13px] text-[#201e1d] hover:bg-[#f6f5f3]"
                  }
                >
                  {option.label}
                </Link>
              );
            })}
          </div>
          <button
            type="button"
            disabled={scanning}
            onClick={onRescan}
            className="inline-flex items-center gap-1.5 rounded-[6px] border border-[rgba(32,30,29,0.10)] bg-[#ffffff] px-3 py-1.5 text-[13px] text-[#201e1d] disabled:opacity-50"
          >
            <RefreshCw size={14} strokeWidth={2} className={scanning ? "animate-spin" : ""} />
            {scanning ? "Scanning…" : "Rescan"}
          </button>
        </div>
      </div>

      <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3">
        <Stat value={sessions} label="sessions" />
        <Stat value={takeaways} label="takeaways" />
        <Stat value={actions} label="actions" />
        <Stat value={chips.filter((chip) => chip.count > 0).length} label="topics covered" />
        <Stat value={candidates} label="candidates waiting" accent={candidates > 0} />
      </dl>

      <nav className="mt-5 flex flex-wrap gap-2" aria-label="Topics">
        {visible.map((chip) => (
          <TopicChip key={chip.slug} chip={chip} />
        ))}
        {hidden.length ? (
          <button
            type="button"
            onClick={() => setShowAllZeros(true)}
            className="inline-flex items-center rounded-full border border-dashed border-[rgba(32,30,29,0.20)] bg-[#ffffff] px-3 py-1.5 text-[13px] text-[#7d7979]"
          >
            + {hidden.length} more
          </button>
        ) : null}
      </nav>
    </header>
  );
}

function Stat({
  value,
  label,
  accent = false,
}: {
  value: number;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <dd className="text-[22px] font-semibold leading-none text-[#201e1d]">{value}</dd>
      <dt className={accent ? "text-[13px] text-[#aa0b56]" : "text-[13px] text-[#605d5d]"}>
        {label}
      </dt>
    </div>
  );
}

function TopicChip({ chip }: { chip: Chip }) {
  const style = topicStyle(chip.slug);
  const Icon = style.icon;
  const empty = chip.count === 0;
  return (
    <a
      href={`#topic-${chip.slug}`}
      className={
        empty
          ? "inline-flex items-center gap-2 rounded-full border border-dashed border-[rgba(32,30,29,0.22)] bg-[#ffffff] py-1 pl-1 pr-3 text-[13px] text-[#9b9797]"
          : "inline-flex items-center gap-2 rounded-full border border-[rgba(32,30,29,0.10)] bg-[#ffffff] py-1 pl-1 pr-3 text-[13px] text-[#201e1d]"
      }
    >
      <span
        className="grid h-[22px] w-[22px] place-items-center rounded-full"
        style={{ background: empty ? "#eae7e7" : style.tint, color: empty ? "#7d7979" : style.ink }}
      >
        <Icon size={13} strokeWidth={2} />
      </span>
      {chip.name}
      <span className="text-[#7d7979]">{chip.count}</span>
    </a>
  );
}
