"use client";

import type { Section } from "@/lib/dashboard/schema";
import { newsToneColor, presentNews } from "@/lib/dashboard/present";
import { MobileCollapse } from "./MobileCollapse";
import { SectionHeading } from "./section-heading";
import styles from "./dashboard.module.css";

type News = Extract<Section, { type: "news" }>;

export function NewsSection({ section, updatedOn }: { section: News; updatedOn: string }) {
  const now = new Date();
  const count = section.items.length;
  const summary = `${count} ${count === 1 ? "story" : "stories"}`;

  return (
    <MobileCollapse
      title={section.heading}
      summary={summary}
      desktopHeading={
        <div className={styles.headingRow}>
          <SectionHeading>{section.heading}</SectionHeading>
          <div className={styles.meta}>
            {count} stories / {updatedOn}
          </div>
        </div>
      }
    >
      <div className={styles.newsGrid}>
        {section.items.map((item) => {
          const card = presentNews(item, now);
          return (
            <a
              key={item.url}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.newsCard}
            >
              <div>
                <div className={styles.newsTop}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={card.icon} width={24} height={24} alt="" className={styles.favicon} />
                  <span className={styles.outlet}>{item.outlet}</span>
                  <span className={styles.domain}>{card.domain}</span>
                </div>
                <div className={styles.headline}>{item.headline}</div>
              </div>
              <div className={styles.newsFoot}>
                <div className={styles.fresh}>
                  <span className={styles.dot} style={{ background: newsToneColor(card.tone) }} />
                  {card.age} / {card.dateLabel}
                </div>
                <div className={styles.read}>Read story →</div>
              </div>
            </a>
          );
        })}
      </div>
    </MobileCollapse>
  );
}
