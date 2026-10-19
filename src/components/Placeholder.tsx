/** Temporary page body for views that are built in later steps of the plan. */
export function Placeholder({ title, note }: { title: string; note: string }) {
  return (
    <div>
      <h1 className="t-title">{title}</h1>
      <p className="t-caption c-tertiary">{note}</p>
    </div>
  )
}
