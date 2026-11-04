"use client";

import { useState } from "react";
import type { WebinarTakeawayRow, WebinarTopicRow, WebinarSessionRow } from "@/lib/webinars/store";
import type { WebinarRange } from "@/lib/webinars/display";
import { SessionCard } from "./session-card";
import { SessionRow } from "./session-row";
import { TopicHeader } from "./topic-header";

type SessionWithTakeaways = WebinarSessionRow & { takeaways: WebinarTakeawayRow[] };

export function TopicSection({
  topic,
  sessions,
  topicNames,
  range,
}: {
  topic: WebinarTopicRow;
  sessions: SessionWithTakeaways[];
  topicNames: Record<string, string>;
  range: WebinarRange;
}) {
  const [openIds, setOpenIds] = useState<Set<string>>(
    () => new Set(sessions[0] ? [sessions[0].id] : [])
  );
  const takeaways = sessions.reduce((sum, session) => sum + session.takeaways.length, 0);
  const actions = sessions.reduce(
    (sum, session) => sum + session.takeaways.filter((takeaway) => takeaway.is_action).length,
    0
  );

  const setOpen = (id: string, open: boolean) => {
    setOpenIds((current) => {
      const next = new Set(current);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  return (
    <section id={`topic-${topic.slug}`} className="scroll-mt-24">
      <TopicHeader
        slug={topic.slug}
        name={topic.name}
        sessions={sessions.length}
        takeaways={takeaways}
        actions={actions}
        range={range}
      />
      <div className="mt-4 flex flex-col gap-4">
        {sessions.map((session) =>
          openIds.has(session.id) ? (
            <SessionCard
              key={session.id}
              session={session}
              takeaways={session.takeaways}
              topicNames={topicNames}
              onCollapse={() => setOpen(session.id, false)}
            />
          ) : (
            <SessionRow
              key={session.id}
              session={session}
              takeawayCount={session.takeaways.length}
              actionCount={session.takeaways.filter((takeaway) => takeaway.is_action).length}
              onExpand={() => setOpen(session.id, true)}
            />
          )
        )}
      </div>
    </section>
  );
}
