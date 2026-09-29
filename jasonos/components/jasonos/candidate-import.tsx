"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import Papa from "papaparse";
import { Upload, FileText, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ALL_CLUSTERS, CLUSTER_LABEL, type AlumniCluster } from "@/lib/ranker/score";
import { bulkInsertContacts } from "@/lib/actions/contacts";

type ColField =
  | "name"
  | "first_name"
  | "last_name"
  | "email"
  | "linkedin_url"
  | "title"
  | "company"
  | "last_touch_date"
  | "alumni_cluster"
  | "ignore";

const FIELD_LABEL: Record<ColField, string> = {
  name: "Full name",
  first_name: "First name",
  last_name: "Last name",
  email: "Email",
  linkedin_url: "LinkedIn URL",
  title: "Title",
  company: "Company name",
  last_touch_date: "Last contact date",
  alumni_cluster: "Alumni cluster",
  ignore: "— ignore —",
};

// Order matters: more specific matchers first. Each matcher is tested as an
// exact-token or prefix match against the lowercased header (split on
// non-word chars), NOT a substring includes — that's what made the previous
// version map "Marketing contact status" to "name".
const FIELD_GUESS: Array<{ field: ColField; matchers: string[] }> = [
  { field: "first_name", matchers: ["first name", "firstname", "given name"] },
  { field: "last_name", matchers: ["last name", "lastname", "surname", "family name"] },
  { field: "email", matchers: ["email", "e-mail", "primary email"] },
  { field: "linkedin_url", matchers: ["linkedin", "li url", "linkedin url", "profile url"] },
  { field: "title", matchers: ["title", "role", "position", "job title"] },
  { field: "last_touch_date", matchers: [
    "last contact", "last touch", "last meeting", "last activity", "last interaction",
  ] },
  { field: "alumni_cluster", matchers: ["alumni", "cluster", "alumni cluster"] },
  { field: "company", matchers: ["company name", "company", "organization", "employer"] },
  { field: "name", matchers: ["full name", "name"] },
];

const NEGATIVE_HINTS = [
  "id",
  "owner",
  "status",
  "phone",
  "city",
  "country",
  "region",
  "industry",
  "lead",
  "create",
  "source",
  "list",
  "tag",
];

function tokenize(header: string): string[] {
  return header.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

function guessField(header: string): ColField {
  const lower = header.toLowerCase().trim();
  const tokens = tokenize(header);

  // Skip obviously non-mappable headers (Record IDs, owners, statuses, etc.)
  if (
    NEGATIVE_HINTS.some((h) => tokens.includes(h)) &&
    !lower.includes("name") &&
    !lower.includes("email") &&
    !lower.includes("linkedin") &&
    !lower.includes("alumni") &&
    !lower.includes("last activity") &&
    !lower.includes("last contact")
  ) {
    return "ignore";
  }

  for (const { field, matchers } of FIELD_GUESS) {
    for (const m of matchers) {
      if (lower === m) return field;
      if (lower.startsWith(m + " ")) return field;
      if (lower.endsWith(" " + m)) return field;
      // For multi-word matchers, allow contiguous token match
      if (m.includes(" ") && lower.includes(m)) return field;
    }
  }
  return "ignore";
}

function guessCluster(value: string | undefined): AlumniCluster | "" {
  if (!value) return "";
  const v = value.toLowerCase();
  for (const c of ALL_CLUSTERS) {
    if (v.includes(c)) return c;
    if (c === "agency" && v.includes("agency.com")) return c;
  }
  return "";
}

interface ParsedRow {
  values: Record<string, string>;
  cluster: AlumniCluster | "";
}

interface Props {
  open: boolean;
  onOpenChange: (b: boolean) => void;
}

export function CandidateImport({ open, onOpenChange }: Props) {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [mapping, setMapping] = useState<Record<string, ColField>>({});
  const [defaultCluster, setDefaultCluster] = useState<AlumniCluster | "">("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [isImporting, startImport] = useTransition();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const reset = useCallback(() => {
    setHeaders([]);
    setRows([]);
    setMapping({});
    setDefaultCluster("");
    setFileName(null);
    setErrorMsg(null);
    setStatusMsg(null);
  }, []);

  const handleFile = useCallback(
    (file: File) => {
      reset();
      setFileName(file.name);
      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (res) => {
          const fields = res.meta.fields ?? [];
          if (fields.length === 0) {
            setErrorMsg("CSV has no header row.");
            return;
          }
          setHeaders(fields);
          const initialMap: Record<string, ColField> = {};
          for (const h of fields) initialMap[h] = guessField(h);
          setMapping(initialMap);

          const parsed: ParsedRow[] = (res.data ?? []).map((r) => {
            const clusterCol = fields.find((f) => initialMap[f] === "alumni_cluster");
            const guessed = clusterCol ? guessCluster(r[clusterCol]) : "";
            return { values: r, cluster: guessed };
          });
          setRows(parsed);
        },
        error: (err) => {
          setErrorMsg(`CSV parse failed: ${err.message}`);
        },
      });
    },
    [reset]
  );

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const colByField = useMemo(() => {
    const out: Partial<Record<ColField, string>> = {};
    for (const [col, field] of Object.entries(mapping)) {
      if (field !== "ignore") out[field] = col;
    }
    return out;
  }, [mapping]);

  const previewRows = rows.slice(0, 5);

  const handleImport = () => {
    setErrorMsg(null);
    setStatusMsg(null);

    const hasFullName = Boolean(colByField.name);
    const hasFirstLast =
      Boolean(colByField.first_name) || Boolean(colByField.last_name);
    if (!hasFullName && !hasFirstLast) {
      setErrorMsg(
        "Map a column to 'Full name', or map 'First name' and/or 'Last name', before importing."
      );
      return;
    }

    const payload = rows.map((row) => {
      const get = (f: ColField) => {
        const col = colByField[f];
        return col ? row.values[col]?.trim() : undefined;
      };
      const email = get("email");
      const cluster: AlumniCluster | undefined =
        row.cluster || defaultCluster || undefined;

      // Compose name: prefer explicit Full name; otherwise join First + Last.
      const fullName = get("name");
      const first = get("first_name");
      const last = get("last_name");
      const joinedName =
        fullName || [first, last].filter(Boolean).join(" ").trim();

      return {
        name: joinedName,
        emails: email ? [email] : [],
        linkedin_url: get("linkedin_url") || undefined,
        title: get("title") || undefined,
        last_touch_date: get("last_touch_date") || undefined,
        alumniCluster: cluster as AlumniCluster | undefined,
      };
    });

    startImport(async () => {
      const res = await bulkInsertContacts(payload);
      if (!res.ok) {
        setErrorMsg(res.error ?? "Insert failed.");
        return;
      }
      setStatusMsg(`Imported ${res.inserted ?? 0} contacts.`);
      setTimeout(() => {
        onOpenChange(false);
        reset();
      }, 1200);
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(b) => {
        onOpenChange(b);
        if (!b) reset();
      }}
    >
      <DialogContent className="max-h-[90vh] w-[min(96vw,1100px)] max-w-[min(96vw,1100px)] overflow-y-auto sm:max-w-[min(96vw,1100px)]">
        <DialogHeader>
          <DialogTitle>Import contacts</DialogTitle>
          <DialogDescription>
            CSV upload. Map columns once, then bulk-insert into{" "}
            <code>jasonos.contacts</code>. Alumni cluster gets prefixed
            <code className="ml-1">alumni:</code>and stored on{" "}
            <code>tags</code>.
          </DialogDescription>
        </DialogHeader>

        {headers.length === 0 ? (
          <div
            onDrop={onDrop}
            onDragOver={(e) => e.preventDefault()}
            className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border bg-muted/20 p-10 text-center"
          >
            <Upload className="h-8 w-8 text-muted-foreground/60" />
            <div className="text-xs text-muted-foreground">
              Drop a CSV here, or
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              Choose file
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              hidden
              onChange={onPick}
            />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium">{fileName}</span>
                <span className="text-muted-foreground">
                  · {rows.length} rows
                </span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={reset}
                className="h-7 gap-1 text-xs"
              >
                <X className="h-3 w-3" />
                Clear
              </Button>
            </div>

            {/* Column mapping */}
            <div className="rounded-md border bg-card p-3">
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Column mapping
              </h3>
              <p className="mb-3 text-[11px] text-muted-foreground">
                Map a single &quot;Full name&quot; column, or map &quot;First name&quot; +
                &quot;Last name&quot; separately and they&apos;ll be joined.
              </p>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {headers.map((h) => (
                  <div key={h} className="space-y-1">
                    <div
                      className="truncate font-mono text-[11px] text-muted-foreground"
                      title={h}
                    >
                      {h}
                    </div>
                    <Select
                      value={mapping[h]}
                      onValueChange={(v) =>
                        setMapping((m) => ({ ...m, [h]: v as ColField }))
                      }
                    >
                      <SelectTrigger className="h-7 w-full text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(FIELD_LABEL) as ColField[]).map((f) => (
                          <SelectItem key={f} value={f}>
                            {FIELD_LABEL[f]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>

            {/* Default cluster */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">
                Default alumni cluster (used when no cluster on row):
              </span>
              <Select
                value={defaultCluster || "__none"}
                onValueChange={(v) =>
                  setDefaultCluster(v === "__none" ? "" : (v as AlumniCluster))
                }
              >
                <SelectTrigger className="h-7 w-[160px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">None</SelectItem>
                  {ALL_CLUSTERS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CLUSTER_LABEL[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Preview */}
            <div className="overflow-hidden rounded-md border">
              <div className="bg-muted/40 px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                Preview · first {previewRows.length} rows
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead className="bg-muted/20">
                    <tr>
                      {headers.map((h) => (
                        <th
                          key={h}
                          className="px-2 py-1 text-left font-mono text-muted-foreground"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((r, i) => (
                      <tr key={i} className="border-t border-border/60">
                        {headers.map((h) => (
                          <td key={h} className="px-2 py-1 align-top">
                            {r.values[h] ?? ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {errorMsg ? (
          <div className="rounded-md border border-rung-1 bg-rung-1 px-2 py-1.5 text-[11px] ">
            {errorMsg}
          </div>
        ) : null}
        {statusMsg ? (
          <div className="rounded-md border border-[var(--jos-line)] bg-rung-4 px-2 py-1.5 text-[11px] ">
            {statusMsg}
          </div>
        ) : null}

        <DialogFooter>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isImporting}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleImport}
            disabled={rows.length === 0 || isImporting}
            className="bg-rung-3 hover:bg-rung-3 text-white"
          >
            {isImporting ? "Importing…" : `Import ${rows.length} contacts`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
