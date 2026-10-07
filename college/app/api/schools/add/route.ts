import { NextResponse } from "next/server";
import { isSession, requireCollegeSession } from "@/lib/auth";
import { recordActivity } from "@/lib/activity-log";
import {
  getKyleResidency,
  getRateThatAppliesToKyle,
  getRegion,
} from "@/lib/campus-size";
import { applySchoolFacts, createSchool, listSchools, supabaseConfigured, updateSchool } from "@/lib/db";
import { lookupMetro } from "@/lib/metro";
import {
  fetchScorecardByUnitId,
  fetchScorecardEngineeringBundle,
  ScorecardUnsupportedError,
} from "@/lib/scorecard";
import { lookupSchool } from "@/lib/school-lookup";

function todayIsoDate(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export const maxDuration = 300;

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

    let school = await updateSchool(created.id, {
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
      driveAddress: `${scorecard.name}, ${scorecard.location}`,
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

    try {
      const { options, coreOffers } = await fetchScorecardEngineeringBundle(
        scorecard.unitId,
        school.id,
      );
      school = await updateSchool(school.id, {
        programOptions: options,
        programOptionsCheckedDate: todayIsoDate(),
        ...(coreOffers.mechanicalEngineering
          ? { mechanicalEngineering: coreOffers.mechanicalEngineering }
          : {}),
        ...(coreOffers.materials ? { materials: coreOffers.materials } : {}),
        ...(coreOffers.aerospaceEngineering
          ? { aerospaceEngineering: coreOffers.aerospaceEngineering }
          : {}),
      });
    } catch (error) {
      console.error("Scorecard engineering programs lookup failed", error);
    }

    // Web search fills essays / recs / deadlines / Partial program notes Scorecard cannot see.
    try {
      const lookup = await lookupSchool(school.name);
      school = await applySchoolFacts(school.id, lookup.facts, { onlyBlank: true });
    } catch (error) {
      console.error("School web lookup failed", error);
    }

    let driveStatus: "ready" | "pending" | "failed" = "pending";
    let refreshed = school;
    try {
      const { addSchoolDrivePoint } = await import("@/lib/driveMatrix");
      await addSchoolDrivePoint({
        schoolId: school.id,
        schoolName: school.name,
        cityState: school.location,
        address: school.driveAddress || undefined,
      });
      driveStatus = "ready";
    } catch (error) {
      console.error("Drive matrix update failed", error);
      driveStatus = "failed";
    }

    // Re-read so drive minutes/miles and program options are attached.
    refreshed = (await listSchools()).find((row) => row.id === school.id) ?? school;

    await recordActivity({
      actorId: session.member.id,
      actorName: session.member.displayName,
      action: "create",
      entityType: "school",
      entityId: refreshed.id,
      summary: `Added college “${refreshed.name}”`,
      detail: { unitId, region, driveStatus },
    });

    return NextResponse.json({ school: refreshed, driveStatus, region });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not add school";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
