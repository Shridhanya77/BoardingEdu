"use client";

import { useMemo, useState } from "react";

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
        <form className="home-tool" onSubmit={(event) => event.preventDefault()}>
          <h3>Class eligibility</h3>
          <p>Uses completed age on 31 March, the cutoff many Indian schools publish.</p>
          <label>
            Child&apos;s date of birth
            <input type="date" value={dob} onChange={(event) => setDob(event.target.value)} />
          </label>
          {classGuide && <p className="home-tool__result" role="status">{classGuide}</p>}
        </form>
        <form className="home-tool" onSubmit={(event) => event.preventDefault()}>
          <h3>Board chooser</h3>
          <p>A short guide across CBSE, ICSE, IB, Cambridge, and state boards.</p>
          <label>
            What matters most?
            <select value={board} onChange={(event) => setBoard(event.target.value as BoardChoice)}>
              <option value="">Choose one</option>
              <option value="national">National exams and schools in many cities</option>
              <option value="international">Study or transfer outside India</option>
              <option value="state">The state curriculum and regional language</option>
            </select>
          </label>
          <label>
            Fee comfort
            <select value={budget} onChange={(event) => setBudget(event.target.value as BudgetChoice)}>
              <option value="">Choose one</option>
              <option value="standard">A typical private-school fee</option>
              <option value="higher">A higher fee is acceptable</option>
            </select>
          </label>
          <label>
            Classroom style
            <select value={style} onChange={(event) => setStyle(event.target.value as StyleChoice)}>
              <option value="">Choose one</option>
              <option value="structured">Structured syllabus and exams</option>
              <option value="inquiry">Projects and inquiry</option>
            </select>
          </label>
          {suggestion && <p className="home-tool__result" role="status">{suggestion}</p>}
        </form>
      </div>
    </section>
  );
}
