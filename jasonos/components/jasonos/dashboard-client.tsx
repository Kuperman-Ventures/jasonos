"use client";

import { useState } from "react";
import { HeroStrip } from "@/components/jasonos/hero-strip";
import { CrossTrackKpis } from "@/components/jasonos/cross-kpis";
import { MustDos } from "@/components/jasonos/must-dos";
import { ActionQueue } from "@/components/jasonos/action-queue";
import { MonitoringGrid } from "@/components/jasonos/monitoring-grid";
import { RecruiterOutreachCard } from "@/components/jasonos/recruiter-outreach-card";
import { BrowningCard } from "@/components/jasonos/browning-card";
import { DailyWrap } from "@/components/jasonos/daily-wrap";
import { ThisWeekCard } from "@/components/jasonos/this-week-card";
import { WhatNowCard } from "@/components/jasonos/what-now-card";
import { PinnedToday } from "@/components/jasonos/pinned-today";
import { AskDispatchButton } from "@/components/dispatch/AskDispatchButton";
import type { Track, ActionCard } from "@/lib/types";
import type { DashboardData } from "@/lib/data/dashboard";
import type { WhatNowAdvice } from "@/lib/server-actions/what-now";
import type { BrowningSummary } from "@/lib/browning/types";

export function DashboardClient({
  data,
  whatNow,
  pinned,
  browningSummary,
}: {
  data: DashboardData;
  whatNow: WhatNowAdvice;
  pinned: ActionCard[];
  browningSummary: BrowningSummary;
}) {
  const [trackFilter, setTrackFilter] = useState<Track | null>(null);

  return (
    <div className="mx-auto max-w-[1800px] space-y-4 px-4 py-4">
      <div className="flex justify-end">
        <AskDispatchButton
          requestType="daily_briefing"
          sourcePage="/"
          context={{
            date: new Date().toISOString().slice(0, 10),
            open_tasks: data.kpis,
            pending_outreaches: data.hero.find((item) => item.track === "job_search"),
          }}
          label="Ask Dispatch for briefing"
        />
      </div>

      <div className="space-y-3">
        <PinnedToday cards={pinned} />
        <WhatNowCard initial={whatNow} />
      </div>

      <ThisWeekCard />
      <HeroStrip
        data={data.hero}
        activeTrack={trackFilter}
        onSelectTrack={setTrackFilter}
      />
      <CrossTrackKpis kpis={data.kpis} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <MustDos />
          <ActionQueue trackFilter={trackFilter} onTrackFilter={setTrackFilter} />
        </div>
        <div className="space-y-4">
          <RecruiterOutreachCard stats={data.recruiterOutreach} />
          <BrowningCard summary={browningSummary} />
          <MonitoringGrid tiles={data.tiles} trackFilter={trackFilter} />
        </div>
      </div>

      <DailyWrap />
    </div>
  );
}
