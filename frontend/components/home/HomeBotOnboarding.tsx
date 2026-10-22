"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Bot, Check, X } from "lucide-react";
import type { BoardListItem } from "@/lib/api";
import { schoolDirectoryPath } from "@/lib/school-urls";
import type { HomeSchoolCategory } from "@/lib/seo-slugs";

type OnboardingFilters = {
  category: HomeSchoolCategory | null;
  boards: string[];
  place: string;
  feeRange: string;
};

const feeRanges = [
  { label: "Under ₹1 Lakh", value: "0-100000" },
  { label: "₹1L – ₹3L", value: "100000-300000" },
  { label: "₹3L – ₹6L", value: "300000-600000" },
  { label: "Above ₹6 Lakh", value: "600000-3000000" },
];

export default function HomeBotOnboarding({
  boards,
  onClose,
}: {
  boards: BoardListItem[];
  onClose: () => void;
}) {
  const [step, setStep] = useState(0);
  const [filters, setFilters] = useState<OnboardingFilters>({
    category: null,
    boards: [],
    place: "",
    feeRange: "",
  });

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  function finish(overrides: Partial<OnboardingFilters> = {}) {
    const finalFilters = { ...filters, ...overrides };
    const url = new URL(schoolDirectoryPath(finalFilters.category), window.location.origin);
    finalFilters.boards.forEach((boardId) => url.searchParams.append("board", boardId));
    if (finalFilters.place.trim()) url.searchParams.set("search", finalFilters.place.trim());
    if (finalFilters.feeRange) {
      const [min, max] = finalFilters.feeRange.split("-");
      if (min && max) {
        url.searchParams.set("min_fee", min);
        url.searchParams.set("max_fee", max);
      }
    }
    window.location.assign(url.toString());
  }

  const question = [
    "What kind of school are you looking for?",
    "Which education boards do you prefer?",
    "In which city or state?",
    "What is your annual fee budget?",
  ][step]!;

  return (
    <div className="bot-onboarding">
      <button
        className="bot-onboarding__backdrop"
        type="button"
        aria-label="Close school discovery assistant"
        onClick={onClose}
      />
      <div
        className="bot-onboarding__modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bot-onboarding-title"
      >
        <button
          className="bot-onboarding__close"
          type="button"
          aria-label="Close"
          onClick={onClose}
        >
          <X size={20} />
        </button>

        <div className="bot-onboarding__header">
          <div className="bot-onboarding__avatar" aria-hidden="true">
            <Bot size={24} />
          </div>
          <div>
            <strong id="bot-onboarding-title">School Discovery Bot</strong>
            <span>Let&apos;s build a shortlist for your family</span>
          </div>
        </div>

        <div className="bot-onboarding__content">
          <div className="bot-onboarding__message">{question}</div>

          {step === 0 && (
            <div className="bot-onboarding__options">
              {[
                { label: "Day School", value: "day-school" as const },
                { label: "Boarding School", value: "residential-school" as const },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={filters.category === option.value ? "is-active" : ""}
                  aria-pressed={filters.category === option.value}
                  onClick={() => {
                    setFilters((current) => ({ ...current, category: option.value }));
                    setStep(1);
                  }}
                >
                  {option.label}
                  {filters.category === option.value && <Check size={16} />}
                </button>
              ))}
            </div>
          )}

          {step === 1 && (
            <>
              <div className="bot-onboarding__options bot-onboarding__options--scrollable">
                {boards.map((board) => {
                  const selected = filters.boards.includes(board.board_id);
                  return (
                    <button
                      key={board.board_id}
                      type="button"
                      className={selected ? "is-active" : ""}
                      aria-pressed={selected}
                      onClick={() =>
                        setFilters((current) => ({
                          ...current,
                          boards: selected
                            ? current.boards.filter((id) => id !== board.board_id)
                            : [...current.boards, board.board_id],
                        }))
                      }
                    >
                      {board.board_name}
                      {selected && <Check size={16} />}
                    </button>
                  );
                })}
                {boards.length === 0 && (
                  <p className="bot-onboarding__hint">
                    Board choices are unavailable right now. You can continue without one.
                  </p>
                )}
              </div>
              <div className="bot-onboarding__actions">
                <button type="button" className="bot-onboarding__back" onClick={() => setStep(0)}>
                  <ArrowLeft size={16} /> Back
                </button>
                <button type="button" className="bot-onboarding__next" onClick={() => setStep(2)}>
                  Continue <ArrowRight size={18} />
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="bot-onboarding__input">
                <input
                  type="text"
                  autoFocus
                  aria-label="City or state"
                  placeholder="e.g. Mumbai, Maharashtra"
                  value={filters.place}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, place: event.target.value }))
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") setStep(3);
                  }}
                />
                <button type="button" aria-label="Continue" onClick={() => setStep(3)}>
                  <ArrowRight size={20} />
                </button>
              </div>
              <div className="bot-onboarding__actions">
                <button type="button" className="bot-onboarding__back" onClick={() => setStep(1)}>
                  <ArrowLeft size={16} /> Back
                </button>
                <button type="button" className="bot-onboarding__skip" onClick={() => setStep(3)}>
                  Skip location
                </button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="bot-onboarding__options">
                {feeRanges.map((range) => (
                  <button
                    key={range.value}
                    type="button"
                    className={filters.feeRange === range.value ? "is-active" : ""}
                    aria-pressed={filters.feeRange === range.value}
                    onClick={() =>
                      setFilters((current) => ({ ...current, feeRange: range.value }))
                    }
                  >
                    {range.label}
                    {filters.feeRange === range.value && <Check size={16} />}
                  </button>
                ))}
              </div>
              <div className="bot-onboarding__actions">
                <button type="button" className="bot-onboarding__back" onClick={() => setStep(2)}>
                  <ArrowLeft size={16} /> Back
                </button>
                <button type="button" className="bot-onboarding__next" onClick={() => finish()}>
                  Show matching schools <ArrowRight size={18} />
                </button>
              </div>
              <button
                type="button"
                className="bot-onboarding__skip"
                onClick={() => finish({ feeRange: "" })}
              >
                Skip budget
              </button>
            </>
          )}
        </div>

        <div className="bot-onboarding__footer">
          Step {step + 1} of 4
        </div>
      </div>
    </div>
  );
}
