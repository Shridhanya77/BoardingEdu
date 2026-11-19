"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Compass, Info, Sparkles } from "lucide-react";

const CLASS_BANDS = [
  { min: 3, max: 3, label: "Nursery" },
  { min: 4, max: 4, label: "LKG" },
  { min: 5, max: 5, label: "UKG" },
] as const;

function academicCutoff(today: Date) {
  const year = today.getMonth() > 2 ? today.getFullYear() + 1 : today.getFullYear();
  return new Date(year, 2, 31);
}

function completedYears(birth: Date, on: Date) {
  let years = on.getFullYear() - birth.getFullYear();
  const beforeBirthday = on.getMonth() < birth.getMonth()
    || (on.getMonth() === birth.getMonth() && on.getDate() < birth.getDate());
  if (beforeBirthday) years -= 1;
  return years;
}

function classForAge(age: number) {
  const early = CLASS_BANDS.find((band) => age >= band.min && age <= band.max);
  if (early) return early.label;
  if (age >= 6 && age <= 17) return `Class ${age - 5}`;
  if (age > 17) return "Senior secondary or beyond";
  return "Below a typical nursery age";
}

type BoardChoice = "" | "national" | "international" | "state";
type BudgetChoice = "" | "standard" | "higher";
type StyleChoice = "" | "structured" | "inquiry";

function boardSuggestion(board: BoardChoice, budget: BudgetChoice, style: StyleChoice) {
  if (!board || !budget || !style) return null;
  if (board === "state") {
    return "A state board is the closest match when the family wants the regional curriculum and language.";
  }
  if (board === "international" && style === "inquiry") {
    return "IB is the closer match for an inquiry-led programme and study outside India.";
  }
  if (board === "international") {
    return "Cambridge is the closer match for an international curriculum with a structured exam path.";
  }
  if (style === "inquiry" && budget === "higher") {
    return "ICSE is a useful starting point when you want a national board with a broader subject load.";
  }
  return "CBSE is the usual starting point for national exams and schools across many cities.";
}

export default function ParentTools() {
  const [dob, setDob] = useState("");
  const [board, setBoard] = useState<BoardChoice>("");
  const [budget, setBudget] = useState<BudgetChoice>("");
  const [style, setStyle] = useState<StyleChoice>("");

  const classGuide = useMemo(() => {
    if (!dob) return null;
    const birth = new Date(`${dob}T00:00:00`);
    if (Number.isNaN(birth.getTime())) return null;
    const cutoff = academicCutoff(new Date());
    const age = completedYears(birth, cutoff);
    if (age < 0) return "That date of birth is after the next 31 March cutoff.";
    return `Around ${classForAge(age)} on 31 March ${cutoff.getFullYear()}, if the child has completed ${age} ${age === 1 ? "year" : "years"}.`;
  }, [dob]);

  const suggestion = boardSuggestion(board, budget, style);

  return (
    <section className="home-section home-tools" id="parent-tools" aria-labelledby="parent-tools-title">
      <div className="home-section__heading home-section__heading--centered">
        <div>
          <div className="section-eyebrow">PARENT TOOLS</div>
          <h2 id="parent-tools-title">Two quick checks before you shortlist</h2>
          <p>These are starting points. Each school sets its own age cutoff and board.</p>
        </div>
      </div>
      <div className="home-tools__grid">
        <form className="home-tool home-tool--eligibility" onSubmit={(event) => event.preventDefault()}>
          <div className="home-tool__intro">
            <span className="home-tool__icon home-tool__icon--age" aria-hidden="true">
              <CalendarDays size={21} />
            </span>
            <div>
              <span className="home-tool__step">01 · AGE CHECK</span>
              <h3>Class eligibility</h3>
            </div>
          </div>
          <p className="home-tool__description">
            Uses completed age on 31 March, the cutoff many Indian schools publish.
          </p>
          <label className="home-tool__field" htmlFor="parent-tools-dob">
            <span>Child&apos;s date of birth</span>
            <input id="parent-tools-dob"
              aria-describedby="parent-tools-dob-hint"
              type="date"
              value={dob}
              onChange={(event) => setDob(event.target.value)}
            />
          </label>
          <p className="home-tool__hint" id="parent-tools-dob-hint">
            Use this as a guide; schools may set different age cutoffs.
          </p>
          {classGuide ? (
            <p className="home-tool__result" role="status">
              <Info size={18} aria-hidden="true" />
              <span>{classGuide}</span>
            </p>
          ) : (
            <div className="home-tool__prompt">
              <Sparkles size={16} aria-hidden="true" />
              <span>Your age-based starting point will appear here.</span>
            </div>
          )}
        </form>
        <form className="home-tool home-tool--board" onSubmit={(event) => event.preventDefault()}>
          <div className="home-tool__intro">
            <span className="home-tool__icon home-tool__icon--board" aria-hidden="true">
              <Compass size={21} />
            </span>
            <div>
              <span className="home-tool__step">02 · FIND YOUR FIT</span>
              <h3>Board chooser</h3>
            </div>
          </div>
          <p className="home-tool__description">
            A short guide across CBSE, ICSE, IB, Cambridge, and state boards.
          </p>
          <label className="home-tool__field">
            <span>What matters most?</span>
            <select
              value={board}
              onChange={(event) => setBoard(event.target.value as BoardChoice)}
            >
              <option value="">Choose one</option>
              <option value="national">National exams and schools in many cities</option>
              <option value="international">Study or transfer outside India</option>
              <option value="state">The state curriculum and regional language</option>
            </select>
          </label>
          <label className="home-tool__field">
            <span>Fee comfort</span>
            <select value={budget} onChange={(event) => setBudget(event.target.value as BudgetChoice)}>
              <option value="">Choose one</option>
              <option value="standard">A typical private-school fee</option>
              <option value="higher">A higher fee is acceptable</option>
            </select>
          </label>
          <label className="home-tool__field">
            <span>Classroom style</span>
            <select value={style} onChange={(event) => setStyle(event.target.value as StyleChoice)}>
              <option value="">Choose one</option>
              <option value="structured">Structured syllabus and exams</option>
              <option value="inquiry">Projects and inquiry</option>
            </select>
          </label>
          {suggestion ? (
            <p className="home-tool__result" role="status">
              <Info size={18} aria-hidden="true" />
              <span>{suggestion}</span>
            </p>
          ) : (
            <div className="home-tool__prompt">
              <Sparkles size={16} aria-hidden="true" />
              <span>Choose an option in each field to see a starting suggestion.</span>
            </div>
          )}
        </form>
      </div>
    </section>
  );
}
