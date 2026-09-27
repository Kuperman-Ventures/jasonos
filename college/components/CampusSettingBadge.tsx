"use client";

import {
  Building,
  Buildings,
  GraduationCap,
  House,
  TreeEvergreen,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import {
  formatMetroPopulation,
  formatMetroPopulationShort,
  getMetroTier,
  metroTierBars,
  type CampusSetting,
} from "@/lib/campus-size";

const SETTING_ICONS: Record<CampusSetting, Icon> = {
  Urban: Buildings,
  Suburban: House,
  "Small city": Building,
  "College town": GraduationCap,
  "Small town": TreeEvergreen,
};

function MetroBars({ filled }: { filled: number }) {
  return (
    <span className="campus-metro-bars" aria-hidden="true">
      {[1, 2, 3, 4].map((step) => (
        <i key={step} className={step <= filled ? "on" : undefined} data-step={step} />
      ))}
    </span>
  );
}

export function CampusSettingBadge({
  campusSetting,
  metroArea,
  metroPopulation,
  location,
  showLabel = true,
}: {
  campusSetting: string;
  metroArea?: string | null;
  metroPopulation?: number | null;
  /** Used for college-town / small-town tooltips. */
  location?: string;
  showLabel?: boolean;
}) {
  const setting = campusSetting as CampusSetting;
  const Icon = SETTING_ICONS[setting];
  if (!Icon) {
    return <span className="campus-setting-badge is-empty">Not set</span>;
  }

  const tier = getMetroTier(metroPopulation);
  const bars = metroTierBars(tier);
  const showBars = bars > 0;

  let tooltip = String(setting);
  if (showBars && metroArea) {
    const pop =
      metroPopulation != null && Number.isFinite(metroPopulation)
        ? formatMetroPopulationShort(metroPopulation)
        : "";
    tooltip = pop ? `${metroArea} metro, ${pop}` : `${metroArea} metro`;
  } else if (location?.trim()) {
    tooltip = `${setting} · ${location.trim()}`;
  }

  const ariaBits: string[] = [setting];
  if (tier) ariaBits.push(tier);
  if (showBars && metroArea && metroPopulation != null) {
    ariaBits.push(`${metroArea}, ${formatMetroPopulation(metroPopulation)} people`);
  } else if (location?.trim()) {
    ariaBits.push(location.trim());
  }

  return (
    <span className="campus-setting-badge" title={tooltip} aria-label={ariaBits.join(". ")}>
      <Icon className="campus-setting-icon" size={16} weight="duotone" aria-hidden="true" />
      {showBars ? <MetroBars filled={bars} /> : null}
      {showLabel ? <span className="campus-setting-label">{setting}</span> : null}
    </span>
  );
}
