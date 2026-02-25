import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';

export function ChatSkeleton() {
  return (
    <Card className="h-[600px] p-4 space-y-4">
      <Skeleton className="h-6 w-48" />
      <div className="space-y-3 flex-1">
        <div className="flex justify-end">
          <Skeleton className="h-10 w-48 rounded-lg" />
        </div>
        <Skeleton className="h-16 w-64 rounded-lg" />
        <div className="flex justify-end">
          <Skeleton className="h-10 w-36 rounded-lg" />
        </div>
        <Skeleton className="h-20 w-72 rounded-lg" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-16" />
      </div>
    </Card>
  );
}
