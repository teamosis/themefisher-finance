import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsSkeleton() {
  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-8 pb-16">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-56 sm:w-64 rounded-lg" />
        <Skeleton className="h-4 w-72 sm:w-80 rounded-md" />
      </div>

      {/* Add Account Card */}
      <Card className="border-border bg-card shadow-xs">
        <CardHeader className="p-5 sm:p-6 pb-2">
          <Skeleton className="h-5 w-48 rounded" />
        </CardHeader>
        <CardContent className="p-5 sm:p-6 pt-2 flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-28 rounded" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-28 rounded" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-28 rounded" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <Skeleton className="h-10 w-32 rounded-xl" />
          </div>
        </CardContent>
      </Card>

      {/* Existing Accounts Card */}
      <Card className="border-border bg-card shadow-xs">
        <CardHeader className="p-5 sm:p-6 pb-4 border-b border-border">
          <Skeleton className="h-5 w-40 rounded" />
        </CardHeader>
        <CardContent className="p-5 sm:p-6 flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="border border-border rounded-xl p-4 flex justify-between items-start gap-4"
            >
              <div className="flex flex-col gap-2 flex-1">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-44 rounded" />
                  <Skeleton className="h-4 w-20 rounded" />
                </div>
                <Skeleton className="h-3.5 w-60 rounded" />
                <Skeleton className="h-3.5 w-40 rounded" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-16 rounded-xl" />
                <Skeleton className="h-8 w-16 rounded-xl" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
