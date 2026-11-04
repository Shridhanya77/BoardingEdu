const MAX_ANNUAL_FEE = 3_000_000;

type FeeRangeFilterProps = {
  value: [number, number];
  onValueCommit: (value: [number, number]) => void;
};

const presets: { label: string; value: [number, number] }[] = [
  { label: "Any fee", value: [0, MAX_ANNUAL_FEE] },
  { label: "Under ₹5L", value: [0, 500_000] },
  { label: "₹5L–₹10L", value: [500_000, 1_000_000] },
  { label: "₹10L–₹20L", value: [1_000_000, 2_000_000] },
  { label: "₹20L+", value: [2_000_000, MAX_ANNUAL_FEE] },
];

export default function FeeRangeFilter({
  value,
  onValueCommit,
}: FeeRangeFilterProps) {
  return (
    <div className="fee-range">
      <div
        className="fee-range__presets"
        role="group"
        aria-label="Annual fee ranges"
      >
        {presets.map((preset) => (
          <button
            type="button"
            key={preset.label}
            aria-pressed={
              value[0] === preset.value[0] && value[1] === preset.value[1]
            }
            onClick={() => onValueCommit(preset.value)}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}
