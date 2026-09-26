import type {
  KyleResidency,
  ResidencyDataStatus,
  School,
  SchoolControl,
} from "./types";

export function formatAdmitPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "";
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
}

export function kyleRateLabel(residency: KyleResidency): string {
  if (residency === "In-state") return "Kyle's rate (in-state)";
  if (residency === "Out-of-state") return "Kyle's rate (out-of-state)";
  return "Kyle's rate";
}

export type AdmitResidencyDisplay = {
  kind: "private" | "public" | "unset";
  overall: string;
  kyleRate: string;
  kyleLabel: string;
  year: string;
  status: ResidencyDataStatus | "";
  showStatusBadge: boolean;
  engineeringNote: string;
  policy: string;
  control: SchoolControl | "";
};

export function admitResidencyDisplay(school: Pick<
  School,
  | "control"
  | "residencyDataStatus"
  | "kyleResidency"
  | "overallAdmitRate"
  | "rateThatAppliesToKyle"
  | "admitDataYear"
  | "engineeringResidencyNote"
  | "outOfStatePolicy"
>): AdmitResidencyDisplay {
  const status = school.residencyDataStatus;
  const control = school.control;
  if (status === "Not applicable" || control === "Private") {
    return {
      kind: "private",
      overall: "",
      kyleRate: "",
      kyleLabel: "",
      year: "",
      status,
      showStatusBadge: false,
      engineeringNote: school.engineeringResidencyNote.trim(),
      policy: school.outOfStatePolicy.trim(),
      control,
    };
  }
  if (!status && !control) {
    return {
      kind: "unset",
      overall: "",
      kyleRate: "",
      kyleLabel: "",
      year: "",
      status: "",
      showStatusBadge: false,
      engineeringNote: "",
      policy: "",
      control: "",
    };
  }
  return {
    kind: "public",
    overall: formatAdmitPct(school.overallAdmitRate),
    kyleRate: formatAdmitPct(school.rateThatAppliesToKyle),
    kyleLabel: kyleRateLabel(school.kyleResidency),
    year: school.admitDataYear.trim(),
    status,
    showStatusBadge: status === "Estimated" || status === "Proxy",
    engineeringNote: school.engineeringResidencyNote.trim(),
    policy: school.outOfStatePolicy.trim(),
    control,
  };
}
