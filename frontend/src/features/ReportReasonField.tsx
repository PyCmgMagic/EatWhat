import { useId } from "react";
import { Select } from "../components/Select";
import "./food-report.css";

export type ReportReasonOptions = readonly (readonly [string, string])[];

/** Reason picker shared by the report / correction dialogs. */
export function ReportReasonField({
  value,
  options,
  onChange,
}: {
  value: string;
  options: ReportReasonOptions;
  onChange: (reason: string) => void;
}) {
  const labelId = useId();

  return (
    <div className="food-report-field">
      <span id={labelId}>问题类型</span>
      <Select
        aria-labelledby={labelId}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      >
        {options.map(([optionValue, label]) => (
          <option key={optionValue} value={optionValue}>
            {label}
          </option>
        ))}
      </Select>
    </div>
  );
}
