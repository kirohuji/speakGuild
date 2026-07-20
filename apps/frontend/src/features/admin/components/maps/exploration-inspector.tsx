import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

export function ExplorationInspector({
  title,
  icon,
  image,
  children,
}: {
  title: string;
  icon: ReactNode;
  image?: string | null;
  children: ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-3 p-4">
        {image && (
          <img
            src={image}
            alt=""
            className="h-28 w-full rounded-lg object-cover"
            loading="lazy"
          />
        )}
        <div className="flex items-center gap-2 font-semibold">
          {icon}
          <span className="min-w-0 truncate">{title}</span>
        </div>
        <div className="space-y-3 text-sm text-muted-foreground">
          {children}
        </div>
      </CardContent>
    </Card>
  );
}
