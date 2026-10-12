"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import type { SchoolListItem } from "@/lib/api";

const STORAGE_KEY = "boardingeu:school-comparison:v1";
const MAX_COMPARED_SCHOOLS = 4;

type SearchExperienceValue = {
  comparedSchools: SchoolListItem[];
  hydrated: boolean;
  limitReached: boolean;
  storageError: string | null;
  toggleSchool: (school: SchoolListItem) => void;
  removeSchool: (schoolId: string) => void;
  clearSchools: () => void;
};

const SearchExperienceContext =
  createContext<SearchExperienceValue | null>(null);

function isSchoolList(value: unknown): value is SchoolListItem[] {
  return (
    Array.isArray(value) &&
    value.length <= MAX_COMPARED_SCHOOLS &&
    value.every(
      (school): school is SchoolListItem =>
        typeof school === "object" &&
        school !== null &&
        "school_id" in school &&
        typeof school.school_id === "string" &&
        "school_name" in school &&
        typeof school.school_name === "string"
    )
  );
}

export function SearchExperienceProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [comparedSchools, setComparedSchools] = useState<SchoolListItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const storedValue = window.localStorage.getItem(STORAGE_KEY);
      if (storedValue) {
        const parsed: unknown = JSON.parse(storedValue);
        if (isSchoolList(parsed)) setComparedSchools(parsed);
      }
    } catch {
      setStorageError("School comparison could not be restored on this device.");
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(comparedSchools));
    } catch {
      setStorageError("School comparison could not be saved on this device.");
    }
  }, [comparedSchools, hydrated]);

  const toggleSchool = useCallback((school: SchoolListItem) => {
    const alreadySelected = comparedSchools.some(
      (item) => item.school_id === school.school_id
    );
    if (alreadySelected) {
      setLimitReached(false);
      setComparedSchools((current) =>
        current.filter((item) => item.school_id !== school.school_id)
      );
    } else if (comparedSchools.length >= MAX_COMPARED_SCHOOLS) {
      setLimitReached(true);
    } else {
      setLimitReached(false);
      setComparedSchools((current) => [...current, school]);
    }
  }, [comparedSchools]);

  const removeSchool = useCallback((schoolId: string) => {
    setLimitReached(false);
    setComparedSchools((current) =>
      current.filter((school) => school.school_id !== schoolId)
    );
  }, []);

  const clearSchools = useCallback(() => {
    setLimitReached(false);
    setComparedSchools([]);
  }, []);

  const value = useMemo(
    () => ({
      comparedSchools,
      hydrated,
      limitReached,
      storageError,
      toggleSchool,
      removeSchool,
      clearSchools,
    }),
    [
      comparedSchools,
      hydrated,
      limitReached,
      storageError,
      toggleSchool,
      removeSchool,
      clearSchools,
    ]
  );

  return (
    <SearchExperienceContext.Provider value={value}>
      {children}
    </SearchExperienceContext.Provider>
  );
}

export function useSearchExperience() {
  const value = useContext(SearchExperienceContext);
  if (!value) {
    throw new Error(
      "useSearchExperience must be used inside SearchExperienceProvider."
    );
  }
  return value;
}
