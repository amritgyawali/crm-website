// Shown while a page's data loads. Grey blocks in the shape of a page header, figures and a table.
export default function Loading() {
  const bar = "bg-well rounded-[2px] animate-pulse";
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className={`${bar} h-8 w-64 mb-2`} />
      <div className={`${bar} h-4 w-96 mb-7`} />
      <div className="grid grid-cols-2 lg:grid-cols-4 border border-rule bg-sheet mb-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="p-4 border-r border-rule last:border-r-0">
            <div className={`${bar} h-3 w-20 mb-3`} />
            <div className={`${bar} h-6 w-28`} />
          </div>
        ))}
      </div>
      <div className="border border-rule bg-sheet">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex gap-6 px-4 py-3.5 border-b border-rule last:border-b-0">
            <div className={`${bar} h-4 w-48`} />
            <div className={`${bar} h-4 w-24`} />
            <div className={`${bar} h-4 w-32`} />
            <div className={`${bar} h-4 w-20 ml-auto`} />
          </div>
        ))}
      </div>
    </div>
  );
}
