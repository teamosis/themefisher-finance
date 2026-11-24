import { Skeleton } from "@/components/ui/skeleton";

export function TableRowsSkeleton({
  rows = 5,
  columns = 5,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rIdx) => (
        <tr key={rIdx} className="hover:bg-muted/10">
          {Array.from({ length: columns }).map((_, cIdx) => (
            <td key={cIdx} className="px-5 py-3.5">
              <Skeleton
                className="h-4 rounded"
                style={{
                  width: `${60 + ((rIdx * 17 + cIdx * 23) % 35)}%`,
                }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
