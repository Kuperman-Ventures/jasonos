import { NextResponse } from "next/server";
import { isSession, requireCollegeSession } from "@/lib/auth";
import { recordActivity } from "@/lib/activity-log";
import {
  getKyleResidency,
  getRateThatAppliesToKyle,
  getRegion,
} from "@/lib/campus-size";
import { createSchool, listSchools, supabaseConfigured, updateSchool } from "@/lib/db";
import { lookupMetro } from "@/lib/metro";
import {
  fetchScorecardByUnitId,
  ScorecardUnsupportedError,
} from "@/lib/scorecard";

export const maxDuration = 60;

const PRIVATE_RESIDENCY_NOTES =
  "Private university; admission does not depend on state residency.";

function stateFromLocation(location: string): string {
  const trimmed = location.trim();
  const comma = trimmed.lastIndexOf(",");
  if (comma === -1) return trimmed;
  return trimmed.slice(comma + 1).trim();
}

export async function POST(request: Request) {
  const session = await requireCollegeSession();
  if (!isSession(session)) return session;
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    unitId?: number;
    restore?: boolean;
  };
  const unitId =
    typeof body.unitId === "number" && Number.isFinite(body.unitId)
      ? Math.round(body.unitId)
      : NaN;
  if (!(unitId > 0)) {
    return NextResponse.json({ error: "unitId must be a positive number" }, { status: 400 });
  }

  try {
    const schools = await listSchools();
    const existing = schools.find((school) => school.unitId === unitId) ?? null;

    if (existing) {
      if (body.restore && existing.archived) {
        const restored = await updateSchool(existing.id, {
          archived: false,
          archivedAt: null,
        });
        await recordActivity({
          actorId: session.member.id,
          actorName: session.member.displayName,
          action: "restore",
          entityType: "school",
          entityId: restored.id,
          summary: `Restored college “${restored.name}”`,
        });
        return NextResponse.json({ school: restored, restored: true, driveStatus: "pending" });
      }
      return NextResponse.json(
        {
          error: "School already on the list",
          existing: {
            id: existing.id,
            name: existing.name,
            archived: existing.archived,
          },
        },
        { status: 409 },
      );
    }

    let scorecard;
    try {
      scorecard = await fetchScorecardByUnitId(unitId);
    } catch (error) {
      if (error instanceof ScorecardUnsupportedError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }

    const created = await createSchool(scorecard.name);
    const state = stateFromLocation(scorecard.location);
    const kyleResidency = getKyleResidency(scorecard.control, state);
    const region = getRegion(state);

    let metroArea: string | null = null;
    let metroPopulation: number | null = null;
    if (scorecard.lat != null && scorecard.lon != null) {
      try {
        const metro = await lookupMetro(scorecard.lat, scorecard.lon);
        metroArea = metro.metroArea;
        metroPopulation = metro.metroPopulation;
      } catch (error) {
        console.error("Metro lookup failed", error);
      }
    }

    const isPrivate = scorecard.control === "Private";
    const rateThatAppliesToKyle = getRateThatAppliesToKyle({
      kyleResidency,
      inStateAdmitRate: null,
      outOfStateAdmitRate: null,
    });

    const school = await updateSchool(created.id, {
      unitId: scorecard.unitId,
      location: scorecard.location,
      website: scorecard.website,
      control: scorecard.control,
      undergradEnrollment: scorecard.undergradEnrollment,
      satContext: scorecard.sat,
      middle50: scorecard.sat,
      costOfAttendance: scorecard.costOfAttendance,
      netPriceEstimate: scorecard.netPriceEstimate,
      scorecardFetchedDate: scorecard.scorecardFetchedDate,
      listPhase: "exploration",
      phasesParticipated: ["exploration"],
      applicationStatus: "",
      archived: false,
      archivedAt: null,
      selectivityTier: "",
      metroArea,
      metroPopulation,
      kyleResidency,
      rateThatAppliesToKyle,
      residencyDataStatus: isPrivate ? "Not applicable" : "",
      residencyNotes: isPrivate ? PRIVATE_RESIDENCY_NOTES : "",
      researchCompleted: isPrivate ? ["Admissions by residency"] : [],
    });

    // TODO: kick off drive-matrix update for this school once a write path exists
    // (lib/drive-matrix.ts is currently a static JSON reader only).
    const driveStatus = "pending" as const;

    await recordActivity({
      actorId: session.member.id,
      actorName: session.member.displayName,
      action: "create",
      entityType: "school",
      entityId: school.id,
      summary: `Added college “${school.name}”`,
      detail: { unitId, region, driveStatus },
    });

    return NextResponse.json({ school, driveStatus, region });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not add school";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
