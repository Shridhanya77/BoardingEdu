"use client";

import { useEffect, useRef, useState } from "react";

const MAX_ANNUAL_FEE = 3_000_000;
const STEP = 50_000;

type FeeRangeSliderProps = {
  value: [number, number];
  onValueCommit: (value: [number, number]) => void;
};

function formatRupees(value: number) {
  if (value === 0) return "₹0";
  if (value >= 100_000) {
    return `₹${(value / 100_000).toLocaleString("en-IN", {
      maximumFractionDigits: 1,
    })}L`;
  }
  return `₹${new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 1,
  }).format(value)}`;
}

const presets: { label: string; value: [number, number] }[] = [
  { label: "Under ₹5L", value: [0, 500_000] },
  { label: "₹5L–₹10L", value: [500_000, 1_000_000] },
  { label: "₹10L–₹20L", value: [1_000_000, 2_000_000] },
  { label: "₹20L+", value: [2_000_000, MAX_ANNUAL_FEE] },
];

export default function FeeRangeSlider({
  value,
  onValueCommit,
}: FeeRangeSliderProps) {
  const [draft, setDraft] = useState(value);
  const draftRef = useRef(value);

  useEffect(() => {
    draftRef.current = value;
    setDraft(value);
  }, [value]);

  function commitDraft() {
    onValueCommit(draftRef.current);
  }

  function updateThumb(index: 0 | 1, rawValue: string) {
    const next = [...draftRef.current] as [number, number];
    const parsed = Number(rawValue);
    next[index] =
      index === 0
        ? Math.min(parsed, next[1] - STEP)
        : Math.max(parsed, next[0] + STEP);
    draftRef.current = next;
    setDraft(next);
    return next;
  }

  return (
    <div className="fee-range">
      <div className="fee-range__labels" aria-live="polite">
        <span>{formatRupees(draft[0])}</span>
        <span>to</span>
        <span>{formatRupees(draft[1])}</span>
      </div>

      <div className="fee-range__sliders">
        <label className="sr-only" htmlFor="annual-fee-min">
          Minimum annual fee
        </label>
        <input
          id="annual-fee-min"
          type="range"
          min={0}
          max={MAX_ANNUAL_FEE - STEP}
          step={STEP}
          value={draft[0]}
          onChange={(event) => updateThumb(0, event.target.value)}
          onPointerUp={commitDraft}
          onKeyUp={commitDraft}
        />

        <label className="sr-only" htmlFor="annual-fee-max">
          Maximum annual fee
        </label>
        <input
          id="annual-fee-max"
          type="range"
          min={STEP}
          max={MAX_ANNUAL_FEE}
          step={STEP}
          value={draft[1]}
          onChange={(event) => updateThumb(1, event.target.value)}
          onPointerUp={commitDraft}
          onKeyUp={commitDraft}
        />
      </div>

      <div className="fee-range__presets">
        {presets.map((preset) => (
          <button
            type="button"
            key={preset.label}
            aria-pressed={value[0] === preset.value[0] && value[1] === preset.value[1]}
            onClick={() => {
              draftRef.current = preset.value;
              setDraft(preset.value);
              onValueCommit(preset.value);
            }}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}
