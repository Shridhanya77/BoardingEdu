"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Search, X } from "lucide-react";
import type { BoardListItem, SchoolTypeListItem } from "@/lib/api";
import { trackSearchEvent } from "@/lib/search-analytics";

type SearchCommandPaletteProps = {
  boards: BoardListItem[];
  schoolTypes: SchoolTypeListItem[];
  recentSearches: string[];
  onSearch: (query: string) => void;
  onBoard: (board: BoardListItem) => void;
  onSchoolType: (type: SchoolTypeListItem) => void;
};

export default function SearchCommandPalette({
  boards,
  schoolTypes,
  recentSearches,
  onSearch,
  onBoard,
  onSchoolType,
}: SearchCommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        previousFocusRef.current = document.activeElement as HTMLElement | null;
        setOpen(true);
        trackSearchEvent("search_opened", { variant: "command_palette" });
      }
      if (event.key === "Escape") close();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function close() {
    setOpen(false);
    requestAnimationFrame(() => previousFocusRef.current?.focus());
  }

  function submitSearch(value: string) {
    const normalized = value.trim();
    if (!normalized) return;
    onSearch(normalized);
    close();
  }

  if (!open) return null;

  const normalizedQuery = query.trim().toLowerCase();
  const matchingBoards = boards.filter((board) =>
    `${board.board_name} ${board.board_code}`.toLowerCase().includes(normalizedQuery)
  );
  const matchingTypes = schoolTypes.filter((type) =>
    type.type_name.toLowerCase().includes(normalizedQuery)
  );

  return (
    <div className="command-palette__backdrop" onMouseDown={close}>
      <section
        className="command-palette"
        role="dialog"
        aria-modal="true"
        aria-labelledby="command-palette-title"
        ref={dialogRef}
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
            'button:not([disabled]), input:not([disabled]), [href]'
          );
          if (!focusable?.length) return;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
      >
        <h2 id="command-palette-title" className="sr-only">
          Search schools and filters
        </h2>
        <form
          className="command-palette__input"
          onSubmit={(event) => {
            event.preventDefault();
            submitSearch(query);
          }}
        >
          <Search size={19} aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search schools, cities, or filters…"
            aria-label="Search schools, cities, or filters"
          />
          <button type="button" onClick={close} aria-label="Close search">
            <X size={17} />
          </button>
        </form>

        {query.trim() && (
          <button
            className="command-palette__action"
            type="button"
            onClick={() => submitSearch(query)}
          >
            <Search size={15} />
            Search for “{query.trim()}”
            <ArrowRight size={15} />
          </button>
        )}

        {!query.trim() && recentSearches.length > 0 && (
          <div className="command-palette__group">
            <p>Recent searches</p>
            {recentSearches.slice(0, 5).map((recent) => (
              <button
                className="command-palette__action"
                type="button"
                key={recent}
                onClick={() => submitSearch(recent)}
              >
                <Search size={15} /> {recent}
                <ArrowRight size={15} />
              </button>
            ))}
          </div>
        )}

        {normalizedQuery && matchingBoards.length + matchingTypes.length > 0 && (
          <div className="command-palette__group">
            <p>Quick filters</p>
            {matchingBoards.slice(0, 4).map((board) => (
              <button
                className="command-palette__action"
                type="button"
                key={board.board_id}
                onClick={() => {
                  onBoard(board);
                  close();
                }}
              >
                <span className="command-palette__kind">Board</span>
                {board.board_name}
                <ArrowRight size={15} />
              </button>
            ))}
            {matchingTypes.slice(0, 4).map((type) => (
              <button
                className="command-palette__action"
                type="button"
                key={type.school_type_id}
                onClick={() => {
                  onSchoolType(type);
                  close();
                }}
              >
                <span className="command-palette__kind">Type</span>
                {type.type_name}
                <ArrowRight size={15} />
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
