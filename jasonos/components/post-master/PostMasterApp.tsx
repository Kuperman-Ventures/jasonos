"use client";

import { useState } from "react";
import { ConfiguratorDashboard } from "@/components/post-master/ConfiguratorDashboard";
import { HookPicker } from "@/components/post-master/HookPicker";
import { InputPanel } from "@/components/post-master/InputPanel";
import { OutputPanel } from "@/components/post-master/OutputPanel";
import { ProjectBar } from "@/components/post-master/ProjectBar";
import { ProjectLibrary } from "@/components/post-master/ProjectLibrary";
import { ResearchFindingsPanel } from "@/components/post-master/ResearchFindings";
import {
  deletePostMasterProject,
  getPostMasterProject,
  listPostMasterProjects,
  savePostMasterProject,
} from "@/lib/server-actions/post-master";
import {
  DEFAULT_CONFIG,
  suggestProjectTitle,
  type ConfiguratorState,
  type Hook,
  type InputMode,
  type PostMasterProjectListItem,
  type PostMasterProjectState,
  type PostMasterStep,
  type ResearchFindings,
} from "@/lib/post-master/types";

const STEPS: { id: PostMasterStep; label: string }[] = [
  { id: "idea", label: "01 Idea" },
  { id: "research", label: "02 Research" },
  { id: "config", label: "03 Voice" },
  { id: "hooks", label: "04 Hooks" },
  { id: "output", label: "05 Output" },
];

type PostMasterAppProps = {
  initialProjects: PostMasterProjectListItem[];
};

export function PostMasterApp({ initialProjects }: PostMasterAppProps) {
  const [step, setStep] = useState<PostMasterStep>("idea");
  const [inputMode, setInputMode] = useState<InputMode>("idea");
  const [idea, setIdea] = useState("");
  const [topic, setTopic] = useState("");
  const [guidance, setGuidance] = useState("");
  const [findings, setFindings] = useState<ResearchFindings | null>(null);
  const [config, setConfig] = useState<ConfiguratorState>(DEFAULT_CONFIG);
  const [hooks, setHooks] = useState<Hook[]>([]);
  const [selectedHook, setSelectedHook] = useState<Hook | null>(null);
  const [linkedin, setLinkedin] = useState("");
  const [blog, setBlog] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [projectId, setProjectId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [projects, setProjects] =
    useState<PostMasterProjectListItem[]>(initialProjects);
  const [showLibrary, setShowLibrary] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [loadingProjectId, setLoadingProjectId] = useState<string | null>(null);

  const visibleSteps =
    inputMode === "research" || step === "research"
      ? STEPS
      : STEPS.filter((s) => s.id !== "research");
  const stepIndex = visibleSteps.findIndex((s) => s.id === step);

  function currentSnapshot(): PostMasterProjectState {
    return {
      idea,
      topic,
      guidance,
      findings,
      config,
      hooks,
      selectedHook,
      linkedin,
      blog,
    };
  }

  const displayTitle = titleTouched
    ? title
    : suggestProjectTitle({ title, topic, idea });

  const canSave = Boolean(
    idea.trim() || topic.trim() || linkedin.trim() || blog.trim() || findings
  );

  function applyProject(project: {
    id: string;
    title: string;
    step: PostMasterStep;
    inputMode: InputMode;
    state: PostMasterProjectState;
  }) {
    setProjectId(project.id);
    setTitle(project.title);
    setTitleTouched(true);
    setStep(project.step);
    setInputMode(project.inputMode);
    setIdea(project.state.idea);
    setTopic(project.state.topic);
    setGuidance(project.state.guidance);
    setFindings(project.state.findings);
    setConfig(project.state.config ?? DEFAULT_CONFIG);
    setHooks(project.state.hooks ?? []);
    setSelectedHook(project.state.selectedHook);
    setLinkedin(project.state.linkedin);
    setBlog(project.state.blog);
    setError(null);
    setSaveMessage("Resumed");
    setShowLibrary(false);
  }

  async function refreshProjects() {
    const list = await listPostMasterProjects();
    setProjects(list);
  }

  async function handleSave() {
    setSaving(true);
    setSaveMessage(null);
    setError(null);
    try {
      const result = await savePostMasterProject({
        id: projectId,
        title: displayTitle,
        step,
        inputMode,
        state: currentSnapshot(),
      });
      if (!result.ok) {
        throw new Error(result.error);
      }
      setProjectId(result.id);
      setTitle(result.title);
      setTitleTouched(true);
      setSaveMessage("Saved");
      await refreshProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
      setSaveMessage(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleOpen(id: string) {
    setLoadingProjectId(id);
    setError(null);
    try {
      const project = await getPostMasterProject(id);
      if (!project) {
        throw new Error("Could not load that project.");
      }
      applyProject(project);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open project.");
    } finally {
      setLoadingProjectId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this saved project?")) return;
    setLoadingProjectId(id);
    setError(null);
    try {
      const result = await deletePostMasterProject(id);
      if (!result.ok) throw new Error(result.error);
      if (projectId === id) {
        startOver();
      }
      await refreshProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setLoadingProjectId(null);
    }
  }

  async function runResearch() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/post-master/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, guidance }),
      });
      const data = (await res.json()) as {
        findings?: ResearchFindings;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || "Research failed.");
      }
      if (!data.findings) {
        throw new Error("Research returned no findings.");
      }
      setFindings(data.findings);
      setIdea(data.findings.ideaText);
      setStep("research");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Research failed.");
    } finally {
      setLoading(false);
    }
  }

  async function generateHooks() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/post-master/hooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea, config }),
      });
      const data = (await res.json()) as { hooks?: Hook[]; error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Hook generation failed.");
      }
      setHooks(data.hooks ?? []);
      setSelectedHook(null);
      setStep("hooks");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hook generation failed.");
    } finally {
      setLoading(false);
    }
  }

  async function generateOutput() {
    if (!selectedHook) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/post-master/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea, hook: selectedHook, config }),
      });
      const data = (await res.json()) as {
        linkedin?: string;
        blog?: string;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || "Generation failed.");
      }
      setLinkedin(data.linkedin ?? "");
      setBlog(data.blog ?? "");
      setStep("output");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setLoading(false);
    }
  }

  function startOver() {
    setStep("idea");
    setInputMode("idea");
    setIdea("");
    setTopic("");
    setGuidance("");
    setFindings(null);
    setConfig(DEFAULT_CONFIG);
    setHooks([]);
    setSelectedHook(null);
    setLinkedin("");
    setBlog("");
    setError(null);
    setLoading(false);
    setProjectId(null);
    setTitle("");
    setTitleTouched(false);
    setSaveMessage(null);
    setShowLibrary(false);
  }

  return (
    <div className="pm-shell">
      <header>
        <div className="pm-eyebrow">
          <span>NarrativeOS</span>
          <span aria-hidden>·</span>
          <span>Custom Comms</span>
        </div>
        <h1 className="pm-title pm-display">Post Master</h1>
        <p className="pm-lede">
          Rough idea or researched topic in. LinkedIn post and blog draft out —
          in your voice. Save anytime and pick the project back up later.
        </p>
      </header>

      <ProjectBar
        title={displayTitle}
        onTitleChange={(value) => {
          setTitle(value);
          setTitleTouched(true);
        }}
        projectId={projectId}
        saving={saving}
        saveMessage={saveMessage}
        onSave={handleSave}
        onOpenLibrary={() => {
          setShowLibrary(true);
          setError(null);
          void refreshProjects();
        }}
        onNew={startOver}
        canSave={canSave}
      />

      {error && showLibrary ? <p className="pm-error">{error}</p> : null}

      {showLibrary ? (
        <ProjectLibrary
          projects={projects}
          activeId={projectId}
          loadingId={loadingProjectId}
          onOpen={handleOpen}
          onDelete={handleDelete}
          onClose={() => setShowLibrary(false)}
        />
      ) : (
        <>
          <nav className="pm-steps" aria-label="Post Master steps">
            {visibleSteps.map((s, i) => (
              <span
                key={s.id}
                className="pm-step"
                data-active={s.id === step}
                data-done={i < stepIndex}
              >
                {s.label}
              </span>
            ))}
          </nav>

          {step === "idea" ? (
            <InputPanel
              mode={inputMode}
              onModeChange={(mode) => {
                setInputMode(mode);
                setError(null);
              }}
              idea={idea}
              onIdeaChange={setIdea}
              topic={topic}
              onTopicChange={setTopic}
              guidance={guidance}
              onGuidanceChange={setGuidance}
              onContinueIdea={() => {
                setError(null);
                setFindings(null);
                setStep("config");
              }}
              onRunResearch={runResearch}
              loading={loading}
              error={error}
            />
          ) : null}

          {step === "research" && findings ? (
            <ResearchFindingsPanel
              findings={findings}
              onBack={() => {
                setError(null);
                setStep("idea");
              }}
              onContinue={() => {
                setError(null);
                setStep("config");
              }}
            />
          ) : null}

          {step === "config" ? (
            <ConfiguratorDashboard
              config={config}
              onChange={setConfig}
              onBack={() => {
                setError(null);
                setStep(findings ? "research" : "idea");
              }}
              onGenerateHooks={generateHooks}
              loading={loading}
              error={error}
            />
          ) : null}

          {step === "hooks" ? (
            <HookPicker
              hooks={hooks}
              selectedId={selectedHook?.id ?? null}
              onSelect={setSelectedHook}
              onBack={() => {
                setError(null);
                setStep("config");
              }}
              onContinue={generateOutput}
              loading={loading}
              error={error}
            />
          ) : null}

          {step === "output" ? (
            <OutputPanel
              linkedin={linkedin}
              blog={blog}
              onBack={() => {
                setError(null);
                setStep("hooks");
              }}
              onStartOver={startOver}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
