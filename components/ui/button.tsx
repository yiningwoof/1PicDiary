import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-xl text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white shadow-md shadow-violet-200 hover:-translate-y-0.5 hover:shadow-lg",
        outline: "border border-violet-200 bg-white text-violet-800 shadow-sm hover:border-violet-400 hover:bg-violet-50",
        destructive: "bg-gradient-to-r from-rose-600 to-red-500 text-white shadow-md shadow-rose-200 hover:-translate-y-0.5 hover:shadow-lg",
      },
      size: {
        default: "px-5 py-2.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
