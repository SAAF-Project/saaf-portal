"use client";

const SKILLS = [
  { key: "skillPrompts", label: "Prompts" },
  { key: "skillTools", label: "Tools" },
  { key: "skillRegulatory", label: "Regulatory" },
  { key: "skillOutputs", label: "Outputs" },
] as const;

type SkillKey = (typeof SKILLS)[number]["key"];

export default function SkillSliders({
  values,
  onChange,
  disabled = false,
}: {
  values: Record<SkillKey, number>;
  onChange?: (key: SkillKey, value: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-3">
      {SKILLS.map(({ key, label }) => (
        <div key={key} className="flex items-center gap-3">
          <span className="w-24 text-sm text-muted">{label}</span>
          <input
            type="range"
            min={1}
            max={5}
            value={values[key]}
            disabled={disabled}
            onChange={(e) => onChange?.(key, parseInt(e.target.value))}
            className="flex-1 cursor-pointer disabled:opacity-50"
          />
          <span className="w-6 text-center font-semibold text-sm">
            {values[key]}
          </span>
        </div>
      ))}
    </div>
  );
}
