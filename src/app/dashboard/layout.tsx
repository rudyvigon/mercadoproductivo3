import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className={cn("min-h-screen bg-background")}> 
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
        {children}
      </div>
    </div>
  );
}
