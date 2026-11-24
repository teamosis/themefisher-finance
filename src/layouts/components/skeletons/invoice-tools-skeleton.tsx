import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function InvoiceToolsSkeleton() {
  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-8 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-56 sm:w-72 rounded-lg" />
          <Skeleton className="h-4 w-72 sm:w-96 rounded-md" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-36 rounded-xl" />
          <Skeleton className="h-10 w-40 rounded-xl" />
        </div>
      </div>

      {/* Selectors Card */}
      <Card className="border-border bg-card shadow-xs">
        <CardContent className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-24 rounded" />
            <Skeleton className="h-11 w-full rounded-xl" />
          </div>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-24 rounded" />
            <Skeleton className="h-11 w-full rounded-xl" />
          </div>
        </CardContent>
      </Card>

      {/* Document Tabs & Actions Skeleton */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-28 rounded-xl" />
            <Skeleton className="h-9 w-32 rounded-xl" />
            <Skeleton className="h-9 w-28 rounded-xl" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-24 rounded-xl" />
            <Skeleton className="h-9 w-28 rounded-xl" />
          </div>
        </div>

        {/* Paper Document Preview Skeleton */}
        <div className="bg-card border border-border rounded-2xl shadow-sm p-6 sm:p-10 flex flex-col gap-8">
          <div className="flex justify-between items-start gap-4">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-7 w-48 rounded" />
              <Skeleton className="h-4 w-32 rounded" />
            </div>
            <div className="flex flex-col items-end gap-2">
              <Skeleton className="h-5 w-28 rounded" />
              <Skeleton className="h-4 w-36 rounded" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-border/60">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-20 rounded" />
              <Skeleton className="h-5 w-44 rounded" />
              <Skeleton className="h-4 w-60 rounded" />
            </div>
            <div className="flex flex-col gap-2 sm:items-end">
              <Skeleton className="h-4 w-20 rounded" />
              <Skeleton className="h-5 w-40 rounded" />
              <Skeleton className="h-4 w-52 rounded" />
            </div>
          </div>

          {/* Table preview skeleton */}
          <div className="border border-border/70 rounded-xl overflow-hidden mt-4">
            <div className="bg-muted/40 p-3 flex justify-between gap-4">
              <Skeleton className="h-4 w-1/3 rounded" />
              <Skeleton className="h-4 w-20 rounded" />
              <Skeleton className="h-4 w-20 rounded" />
              <Skeleton className="h-4 w-24 rounded" />
            </div>
            <div className="divide-y divide-border/60">
              <div className="p-3.5 flex justify-between gap-4">
                <Skeleton className="h-4 w-1/2 rounded" />
                <Skeleton className="h-4 w-16 rounded" />
                <Skeleton className="h-4 w-16 rounded" />
                <Skeleton className="h-4 w-20 rounded" />
              </div>
              <div className="p-3.5 flex justify-between gap-4">
                <Skeleton className="h-4 w-2/5 rounded" />
                <Skeleton className="h-4 w-16 rounded" />
                <Skeleton className="h-4 w-16 rounded" />
                <Skeleton className="h-4 w-20 rounded" />
              </div>
            </div>
          </div>

          {/* Totals skeleton */}
          <div className="flex justify-end pt-2">
            <div className="flex flex-col gap-2 w-60">
              <div className="flex justify-between">
                <Skeleton className="h-4 w-20 rounded" />
                <Skeleton className="h-4 w-24 rounded" />
              </div>
              <div className="flex justify-between">
                <Skeleton className="h-5 w-24 rounded" />
                <Skeleton className="h-5 w-28 rounded" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
