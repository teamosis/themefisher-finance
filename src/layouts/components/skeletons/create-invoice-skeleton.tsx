import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function CreateInvoiceSkeleton() {
  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-8 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-56 sm:w-64 rounded-lg" />
          <Skeleton className="h-4 w-72 sm:w-80 rounded-md" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-36 rounded-xl" />
        </div>
      </div>

      {/* Invoice Meta Card */}
      <Card className="border-border bg-card shadow-xs">
        <CardHeader className="p-5 sm:p-6 pb-2">
          <Skeleton className="h-5 w-32 rounded" />
        </CardHeader>
        <CardContent className="p-5 sm:p-6 pt-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-20 rounded" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-20 rounded" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-20 rounded" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-20 rounded" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        </CardContent>
      </Card>

      {/* Line Items Card */}
      <Card className="border-border bg-card shadow-xs">
        <CardHeader className="p-5 sm:p-6 pb-3 flex flex-row items-center justify-between">
          <Skeleton className="h-5 w-28 rounded" />
          <Skeleton className="h-9 w-24 rounded-xl" />
        </CardHeader>
        <CardContent className="p-5 sm:p-6 pt-0 flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-12 gap-3 items-center p-3 rounded-xl border border-border/70"
            >
              <div className="col-span-6">
                <Skeleton className="h-9 w-full rounded-lg" />
              </div>
              <div className="col-span-2">
                <Skeleton className="h-9 w-full rounded-lg" />
              </div>
              <div className="col-span-2">
                <Skeleton className="h-9 w-full rounded-lg" />
              </div>
              <div className="col-span-2 flex justify-end">
                <Skeleton className="h-9 w-9 rounded-lg" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Summary & Submit */}
      <div className="flex flex-col sm:flex-row justify-end gap-4">
        <Skeleton className="h-11 w-44 rounded-xl" />
      </div>
    </div>
  );
}
