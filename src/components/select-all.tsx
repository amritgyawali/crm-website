"use client";

/** Header checkbox that ticks every row checkbox belonging to the given form. */
export function SelectAll({ form }: { form: string }) {
  return (
    <input
      type="checkbox"
      aria-label="Select all rows"
      onChange={(e) => {
        document.querySelectorAll<HTMLInputElement>(`input[type=checkbox][name=ids][form="${form}"]`).forEach((el) => (el.checked = e.target.checked));
      }}
    />
  );
}
