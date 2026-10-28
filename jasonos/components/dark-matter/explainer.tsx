"use client";

import { EXPLAINER, buildExplainerView, clampStep, parseToken } from "@/lib/dark-matter-explainer/model";
import type { LaneColorKey, TokenView } from "@/lib/dark-matter-explainer/types";
import { useEffect, useMemo, useState } from "react";

const PORTRAIT_KEY = "dm-portraits";

function loadPortraits(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(PORTRAIT_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Record<string, string>;
  } catch {
    return {};
  }
}

function cropPortrait(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read image"));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const side = Math.min(img.width, img.height, 240);
        canvas.width = side;
        canvas.height = side;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not crop image"));
          return;
        }
        const source = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - source) / 2, 0, source, source, 0, 0, side, side);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => reject(new Error("Could not load image"));
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function portraitStyle(token: TokenView): { backgroundImage?: string; border: string; boxShadow: string; color: string } {
  return {
    backgroundImage: token.portrait ? `url(${token.portrait})` : undefined,
    border: `2px solid ${token.ring}`,
    boxShadow: `0 0 14px ${token.ring}88`,
    color: token.ring,
  };
}

function BoxMark() {
  return (
    <svg
      className="dm-box"
      viewBox="0 0 220 220"
      width="220"
      height="220"
      aria-hidden="true"
    >
      <g fill="none" stroke="#dff7ff" strokeWidth="1.5" strokeLinejoin="round">
        <path d="M110 18 L186 62 L186 150 L110 194 L34 150 L34 62 Z" opacity=".9" />
        <path d="M34 62 L110 106 L186 62" opacity=".7" />
        <path d="M110 106 L110 194" opacity=".7" />
        <path d="M110 18 L110 106" stroke="#19c3f0" strokeDasharray="3 5" opacity=".6" />
        <path d="M72 40 L148 84 L148 172 M148 40 L72 84 L72 172" stroke="#19c3f0" opacity=".25" />
      </g>
      <path d="M110 106 L186 62 L186 150 L110 194Z" fill="#19c3f0" opacity=".14" />
      <path d="M34 62 L110 106 L110 194 L34 150Z" fill="#ff2e93" opacity=".1" />
    </svg>
  );
}

export function DarkMatterExplainer() {
  const [season, setSeason] = useState<1 | 2>(1);
  const [step, setStep] = useState(99);
  const [trace, setTrace] = useState<"all" | LaneColorKey>("all");
  const [selectedWorld, setSelectedWorld] = useState<number | null>(null);
  const [portraits, setPortraits] = useState<Record<string, string>>({});

  useEffect(() => {
    setPortraits(loadPortraits());
  }, []);

  const view = useMemo(
    () => buildExplainerView({ season, step, trace, selectedWorld, portraits }),
    [season, step, trace, selectedWorld, portraits],
  );

  function pickSeason(next: 1 | 2) {
    setSeason(next);
    setStep(99);
    setSelectedWorld(null);
    setTrace("all");
  }

  function go(delta: number) {
    setStep((current) => clampStep(season, Math.min(current, view.maxStep) + delta));
    setSelectedWorld(null);
  }

  async function savePortrait(letter: string, file: File | undefined) {
    if (!file) return;
    const dataUrl = await cropPortrait(file);
    setPortraits((current) => {
      const next = { ...current, [letter]: dataUrl };
      try {
        window.localStorage.setItem(PORTRAIT_KEY, JSON.stringify(next));
      } catch {
        // Ignore quota / private-mode failures; the portrait still applies this session.
      }
      return next;
    });
  }

  return (
    <>
      <header className="dm-hero">
        <div className="dm-hero-copy">
          <div className="dm-eyebrow">Apple TV · Interactive explainer</div>
          <h1 className="dm-title">Dark Matter</h1>
          <p className="dm-tagline">Every world, every version, every crossing.</p>
          <p className="dm-note">
            Spoilers through S2 E9 · Worlds run in story order, not by distance · S2 E10 has not
            aired.
          </p>
        </div>
        <BoxMark />
      </header>

      <div className="dm-seasons">
        <button
          type="button"
          className={`dm-season${season === 1 ? " is-active" : ""}`}
          onClick={() => pickSeason(1)}
        >
          <span className="dm-season-inner">Season 1 · The swap, the search, the escape</span>
        </button>
        <button
          type="button"
          className={`dm-season${season === 2 ? " is-active" : ""}`}
          onClick={() => pickSeason(2)}
        >
          <span className="dm-season-inner">Season 2 · A family separates; old paths converge</span>
        </button>
      </div>

      <div className="dm-controls">
        <div className="dm-controls-copy">
          <div className="dm-step-label">
            Story step {view.step} of {view.maxStep}
          </div>
          <p className="dm-caption">{view.caption}</p>
        </div>
        <div className="dm-controls-nav">
          <input
            className="dm-slider"
            type="range"
            min={0}
            max={view.maxStep}
            value={view.step}
            aria-label="Story step"
            onChange={(event) => {
              setStep(Number(event.target.value));
              setSelectedWorld(null);
            }}
          />
          <button
            type="button"
            className={`dm-nav-btn${view.step === 0 ? " is-end" : ""}`}
            aria-label="Previous step"
            onClick={() => go(-1)}
          >
            <span>‹</span>Back
          </button>
          <button
            type="button"
            className={`dm-nav-btn${view.step === view.maxStep ? " is-end" : ""}`}
            aria-label="Next step"
            onClick={() => go(1)}
          >
            Next<span>›</span>
          </button>
        </div>
      </div>

      <div className="dm-board">
        <div className="dm-board-inner" style={{ minWidth: view.minWidth }}>
          <div className="dm-lanes">
            {view.lanes.map((lane) => (
              <button
                key={`${lane.colorKey}-${lane.index}`}
                type="button"
                className="dm-lane"
                style={{ opacity: lane.active ? 1 : 0.4 }}
                onClick={() => setTrace(trace === lane.colorKey ? "all" : lane.colorKey)}
              >
                <span className="dm-lane-name">{lane.label}</span>
                <span
                  className="dm-lane-bar"
                  style={{ background: lane.color, boxShadow: `0 0 10px ${lane.color}` }}
                />
                <span className="dm-lane-sub">{lane.sublabel}</span>
              </button>
            ))}
          </div>
          {view.worlds.map((world) => (
            <div
              key={world.index}
              className={`dm-world${world.visible ? "" : " is-hidden"}`}
              style={{ background: `linear-gradient(180deg, ${world.glow} 0, rgba(0,0,0,0) 62%)` }}
            >
              <button
                type="button"
                className="dm-world-head"
                onClick={() => setSelectedWorld(world.index)}
                style={{
                  border: `1px solid ${world.border}`,
                  borderBottom: 0,
                  background: `linear-gradient(180deg, ${world.top} 0, rgba(255,255,255,.02) 100%)`,
                }}
              >
                <span
                  className="dm-world-num"
                  style={{ color: world.accent, textShadow: `0 0 18px ${world.accent}` }}
                >
                  {world.number}
                </span>
                <span className="dm-world-title">{world.title}</span>
                <span className="dm-world-sub">{world.subtitle}</span>
              </button>
              {world.cells.map((cell, cellIndex) => {
                const width = cell.tokens.length ? 48 + (cell.tokens.length - 1) * 36 : 0;
                return (
                  <div key={cellIndex} className="dm-cell" style={{ opacity: cell.opacity }}>
                    <div
                      className="dm-rail is-left"
                      style={{ background: cell.left, boxShadow: `0 0 8px ${cell.glow}` }}
                    />
                    <div
                      className="dm-rail is-right"
                      style={{ background: cell.right, boxShadow: `0 0 8px ${cell.glow}` }}
                    />
                    {cell.hasStop ? (
                      <>
                        <button
                          type="button"
                          className="dm-stops"
                          onClick={() => setSelectedWorld(world.index)}
                          style={{ width, marginLeft: -width / 2 }}
                        >
                          {cell.tokens.map((token, tokenIndex) => (
                            <span
                              key={`${token.letter}-${token.version}-${tokenIndex}`}
                              title={token.name}
                              className="dm-icon"
                              style={{
                                left: tokenIndex * 36,
                                ...portraitStyle(token),
                              }}
                            >
                              <span style={{ opacity: token.portrait ? 0 : 1 }}>{token.letter}</span>
                              <span className="dm-badge" style={{ background: token.ring }}>
                                {token.version}
                              </span>
                            </span>
                          ))}
                        </button>
                        <div className="dm-stop-note">{cell.note}</div>
                      </>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <section
        className="dm-detail"
        style={{
          background: `linear-gradient(135deg, ${view.selected.glow} 0, rgba(255,255,255,.03) 70%)`,
        }}
      >
        <div className="dm-detail-copy">
          <div className="dm-detail-kicker" style={{ color: view.selected.accent }}>
            {view.selected.subtitle}
          </div>
          <h2 className="dm-detail-title">{view.selected.title}</h2>
          <p className="dm-detail-body">{view.selected.description}</p>
        </div>
        <div className="dm-cast">
          <div className="dm-cast-label">Who is here</div>
          <div className="dm-cast-row">
            {view.selected.cast.map((token) => (
              <div className="dm-cast-item" key={`${token.letter}${token.version}`}>
                <span
                  className="dm-cast-icon"
                  style={{
                    ...portraitStyle(token),
                    boxShadow: `0 0 18px ${token.ring}88`,
                  }}
                >
                  <span style={{ opacity: token.portrait ? 0 : 1 }}>{token.letter}</span>
                  <span className="dm-cast-badge" style={{ background: token.ring }}>
                    {token.version}
                  </span>
                </span>
                <span className="dm-cast-name">{token.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="dm-portraits">
        <div className="dm-portraits-label">Character portraits</div>
        <p className="dm-portraits-help">
          Add a portrait for each character, for example from the Dark Matter Wiki character pages.
          Pick or drop an image on a character. It is saved in this browser and replaces the initial
          everywhere on the map.
        </p>
        <div className="dm-portraits-row">
          {Object.entries(EXPLAINER.characters).map(([letter, name]) => {
            const token = parseToken(letter, portraits);
            return (
              <label
                key={letter}
                className="dm-portrait"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  void savePortrait(letter, event.dataTransfer.files[0]);
                }}
              >
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    void savePortrait(letter, event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
                <span
                  className="dm-portrait-icon"
                  style={{
                    ...portraitStyle(token),
                    borderStyle: "dashed",
                  }}
                >
                  <span style={{ opacity: token.portrait ? 0 : 1 }}>{letter}</span>
                </span>
                <span className="dm-portrait-name">{name}</span>
              </label>
            );
          })}
        </div>
      </div>

      <p className="dm-legend">
        Badge number = version · * = another variant · X = local World X version. Ring color: cyan
        Jason, magenta Daniela, amber Amanda, white Charlie, grey others. Solid line: route or
        direct continuation. Dashed line: intervening travel omitted. Minor stops are grouped.
        Select a path name to trace it, or a world to read about it.
      </p>
    </>
  );
}
