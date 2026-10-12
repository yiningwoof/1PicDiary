import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[96px] w-full rounded-xl border border-violet-200 bg-white/90 px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus-visible:border-violet-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-200 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
