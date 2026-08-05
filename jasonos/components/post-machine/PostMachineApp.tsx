"use client";

import { useState } from "react";
import { ConfiguratorDashboard } from "@/components/post-machine/ConfiguratorDashboard";
import { HookPicker } from "@/components/post-machine/HookPicker";
import { InputPanel } from "@/components/post-machine/InputPanel";
import { OutputPanel } from "@/components/post-machine/OutputPanel";
import { ResearchFindingsPanel } from "@/components/post-machine/ResearchFindings";
import {
  DEFAULT_CONFIG,
  type ConfiguratorState,
  type Hook,
  type InputMode,
  type ResearchFindings,
} from "@/lib/post-machine/types";

type Step = "idea" | "research" | "config" | "hooks" | "output";

const STEPS: { id: Step; label: string }[] = [
  { id: "idea", label: "01 Idea" },
  { id: "research", label: "02 Research" },
  { id: "config", label: "03 Voice" },
  { id: "hooks", label: "04 Hooks" },
  { id: "output", label: "05 Output" },
];

export function PostMachineApp() {
  const [step, setStep] = useState<Step>("idea");
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

  const visibleSteps =
    inputMode === "research" || step === "research"
      ? STEPS
      : STEPS.filter((s) => s.id !== "research");
  const stepIndex = visibleSteps.findIndex((s) => s.id === step);

  async function runResearch() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/post-machine/research", {
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
      // Feed the shaped brief into the same idea field hooks/generate already use.
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
      const res = await fetch("/api/post-machine/hooks", {
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
      const res = await fetch("/api/post-machine/generate", {
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
  }

  return (
    <div className="pm-shell">
      <header>
        <div className="pm-eyebrow">
          <span>NarrativeOS</span>
          <span aria-hidden>·</span>
          <span>Custom Comms</span>
        </div>
        <h1 className="pm-title pm-display">Post Machine</h1>
        <p className="pm-lede">
          Rough idea or researched topic in. LinkedIn post and blog draft out —
          in your voice, with the dials set before anything generates.
        </p>
      </header>

      <nav className="pm-steps" aria-label="Post Machine steps">
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
    </div>
  );
}
