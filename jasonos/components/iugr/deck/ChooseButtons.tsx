"use client";

type Option = { id: string; label: string };

type Props = {
  options: Option[];
  selectedId: string | null;
  disabled: boolean;
  onChoose: (id: string) => void;
  consequence?: string | null;
};

export function ChooseButtons({
  options,
  selectedId,
  disabled,
  onChoose,
  consequence,
}: Props) {
  return (
    <div className="iugr-deck-choose">
      <div className="iugr-deck-choose-stack" role="group">
        {options.map((opt) => {
          const selected = selectedId === opt.id;
          const inert = Boolean(selectedId) && !selected;
          return (
            <button
              key={opt.id}
              type="button"
              className={[
                "iugr-deck-choose-btn",
                selected ? "is-selected" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              disabled={disabled || Boolean(selectedId)}
              style={
                selectedId
                  ? { pointerEvents: "none" }
                  : undefined
              }
              aria-pressed={selected}
              onClick={(e) => {
                e.stopPropagation();
                if (selectedId) return;
                onChoose(opt.id);
              }}
            >
              {opt.label}
              {inert ? null : null}
            </button>
          );
        })}
      </div>
      {consequence ? (
        <p className="iugr-deck-consequence is-enter">{consequence}</p>
      ) : null}
    </div>
  );
}
