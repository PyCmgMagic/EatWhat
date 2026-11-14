import "./latest.css";

/** Says next to a field label whether it must be filled in, and any limit. */
export function FieldMark({
  required,
  note,
}: {
  required?: boolean;
  note?: string;
}) {
  return (
    <small className={`ew-field-mark${required ? " is-required" : ""}`}>
      {required ? "必填" : "选填"}
      {note ? ` · ${note}` : ""}
    </small>
  );
}
