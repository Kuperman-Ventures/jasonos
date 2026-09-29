import { AI_MODEL_OPTIONS, collegeAiModelId, isAiModelOption } from "./ai-model";
import { latestCheckedAt, listSourceChecks } from "./data-source-checks";
import { calendarTokenIsSet, loadDataSourceSettings, loadLinkOverrides } from "./data-source-settings";
import { buildDataSources, needAttentionCount, type DataSource } from "./data-sources";
import { listSchools } from "./db";
import type { LinkOverrides } from "./link-overrides";

export type DataSourcesPayload = {
  sources: DataSource[];
  canEdit: boolean;
  lastCheckedAt: string | null;
  needAttention: number;
  schools: { id: string; name: string }[];
  linkOverrides: LinkOverrides;
};

export async function loadDataSourcesPayload(canEdit: boolean): Promise<DataSourcesPayload> {
  const [schools, checks, settings, linkOverrides, calendarTokenSet] = await Promise.all([
    listSchools(),
    listSourceChecks(),
    loadDataSourceSettings(),
    loadLinkOverrides(),
    calendarTokenIsSet(),
  ]);
  const saved = settings.aiModel && isAiModelOption(settings.aiModel) ? settings.aiModel : null;
  const current = collegeAiModelId(null, saved);
  const options = AI_MODEL_OPTIONS.map((o) => o.id);
  const optionLabels = Object.fromEntries(AI_MODEL_OPTIONS.map((o) => [o.id, o.label]));
  if (!options.includes(current)) {
    options.unshift(current);
    optionLabels[current] = `${current} (from env)`;
  }

  const sources = buildDataSources({
    schools,
    checks,
    calendarTokenSet,
    aiModelSetting: { options, value: current, optionLabels },
    linkOverrides,
  });

  return {
    sources,
    canEdit,
    lastCheckedAt: latestCheckedAt(checks),
    needAttention: needAttentionCount(sources),
    schools: schools.filter((s) => !s.archived).map((s) => ({ id: s.id, name: s.name })),
    linkOverrides,
  };
}
