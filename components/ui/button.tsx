import * as React from "react";

import { cn } from "@/lib/utils/cn";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "secondary" | "destructive" | "ghost";
  size?: "default" | "sm" | "lg";
};

export function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium",
        "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--background))]",
        "disabled:pointer-events-none disabled:opacity-50",
        variant === "default" &&
          "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90",
        variant === "secondary" &&
          "bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))] hover:opacity-90",
        variant === "destructive" &&
          "bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))] hover:opacity-90",
        variant === "ghost" && "hover:bg-[hsl(var(--accent))]",
        size === "default" && "h-10 px-4 py-2",
        size === "sm" && "h-9 px-3",
        size === "lg" && "h-11 px-8",
        className,
      )}
      {...props}
    />
  );
}
