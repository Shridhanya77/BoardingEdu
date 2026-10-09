// components/school/SchoolTypeBadges.tsx
import { Home, BedDouble, Sunset } from 'lucide-react';

type SchoolTypeSlug = 'day' | 'boarding' | 'day-boarding';

const TYPE_META: Record<SchoolTypeSlug, {
  label: string;
  icon: typeof Home;
  bg: string;
  text: string;
}> = {
  day:           { label: 'Day School',   icon: Home,      bg: 'bg-yellow-100', text: 'text-yellow-900' },
  boarding:      { label: 'Boarding',     icon: BedDouble, bg: 'bg-green-100',  text: 'text-green-900' },
  'day-boarding': { label: 'Day Boarding', icon: Sunset,    bg: 'bg-pink-100',   text: 'text-pink-900' },
};

export function SchoolTypeBadges({ types }: { types: SchoolTypeSlug[] }) {
  if (!types.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {types.map(t => {
        const meta = TYPE_META[t];
        if (!meta) return null;
        const Icon = meta.icon;
        return (
          <span key={t} className={`inline-flex items-center gap-1 ${meta.bg} ${meta.text} text-[10px] font-bold px-2 py-0.5 rounded`}>
            <Icon size={10} />
            {meta.label}
          </span>
        );
      })}
    </div>
  );
}