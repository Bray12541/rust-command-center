import type { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  compact?: boolean;
}

export function Button({ children, variant = "secondary", compact = false, className = "", ...props }: ButtonProps) {
  return (
    <button
      className={`button button-${variant} ${compact ? "button-compact" : ""} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
