"use client";

import { useState } from "react";
import { ConfiguratorDashboard } from "@/components/post-machine/ConfiguratorDashboard";
import { HookPicker } from "@/components/post-machine/HookPicker";
import { InputPanel } from "@/components/post-machine/InputPanel";
import { OutputPanel } from "@/components/post-machine/OutputPanel";
import {
  DEFAULT_CONFIG,
  type ConfiguratorState,
  type Hook,
} from "@/lib/post-machine/types";

type Step = "idea" | "config" | "hooks" | "output";

const STEPS: { id: Step; label: string }[] = [
  { id: "idea", label: "01 Idea" },
  { id: "config", label: "02 Voice" },
  { id: "hooks", label: "03 Hooks" },
  { id: "output", label: "04 Output" },
];

export function PostMachineApp() {
  const [step, setStep] = useState<Step>("idea");
  const [idea, setIdea] = useState("");
  const [config, setConfig] = useState<ConfiguratorState>(DEFAULT_CONFIG);
  const [hooks, setHooks] = useState<Hook[]>([]);
  const [selectedHook, setSelectedHook] = useState<Hook | null>(null);
  const [linkedin, setLinkedin] = useState("");
  const [blog, setBlog] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stepIndex = STEPS.findIndex((s) => s.id === step);

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
    setIdea("");
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
          Rough idea in. LinkedIn post and blog draft out — in your voice, with
          the dials set before anything generates.
        </p>
      </header>

      <nav className="pm-steps" aria-label="Post Machine steps">
        {STEPS.map((s, i) => (
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
          value={idea}
          onChange={setIdea}
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
            setStep("idea");
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
