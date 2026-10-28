// Holding page for an area whose features arrive in a later milestone.
export function AreaPlaceholder({ title, milestone, items }: { title: string; milestone: string; items: string[] }) {
  return (
    <section>
      <h1 className="text-2xl font-semibold text-zinc-900">{title}</h1>
      <p className="mt-2 text-sm text-zinc-600">Arrives in {milestone}:</p>
      <ul className="mt-2 list-disc pl-5 text-sm text-zinc-700">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
