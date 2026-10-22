"use client";

import { useState } from "react";
import { CircleHelp } from "lucide-react";
import type { SchoolFaq } from "@/lib/school-faqs";

export default function SchoolFaqList({
  schoolName,
  city,
  items,
}: {
  schoolName: string;
  city: string;
  items: SchoolFaq[];
}) {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <article className="detail-panel school-faq" id="faq">
      <div className="detail-panel__heading">
        <span className="detail-panel__icon"><CircleHelp size={18} /></span>
        <div>
          <h2>Frequently asked questions</h2>
          <p>Common questions about {schoolName} in {city}.</p>
        </div>
      </div>
      <div className="faq-list">
        {items.map((item, index) => {
          const open = openIndex === index;
          return (
            <div className={`faq-item ${open ? "faq-item--open" : ""}`} key={item.question}>
              <button
                type="button"
                className="faq-question"
                aria-expanded={open}
                onClick={() => setOpenIndex(open ? -1 : index)}
              >
                {item.question}
                <span className="faq-toggle">{open ? "−" : "+"}</span>
              </button>
              <p className="faq-answer" hidden={!open}>{item.answer}</p>
            </div>
          );
        })}
      </div>
    </article>
  );
}
