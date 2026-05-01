"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDownIcon } from "lucide-react";
import { createAuthClient } from "better-auth/react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const authClient = createAuthClient();

type AdminAccountMenuProps = {
  userEmail: string | null;
  displayName?: string | null;
  triggerClassName?: string;
  /** Dense header (mobile) vs padded card (desktop sidebar). */
  variant?: "default" | "sidebar";
};

export function AdminAccountMenu({
  userEmail,
  displayName,
  triggerClassName,
  variant = "default",
}: AdminAccountMenuProps) {
  const [open, setOpen] = useState(false);

  const email = userEmail ?? "";
  const name = displayName?.trim() ?? "";
  const primary = name || email || "Akun";
  const showEmailRow = Boolean(name && email);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label="Menu akun"
        className={cn("w-full", triggerClassName)}
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              "min-h-0 w-full shrink justify-between gap-2 shadow-none",
              variant === "sidebar"
                ? "rounded-xl border-sidebar-border/60 bg-sidebar-accent/40 px-3 py-2.5 hover:bg-sidebar-accent/70"
                : "border-transparent bg-transparent px-1 hover:bg-transparent",
            )}
          />
        }
      >
        <span className="min-w-0 flex-1 text-left">
          <span className="block truncate text-sm font-medium leading-snug">
            {primary}
          </span>
          {showEmailRow ? (
            <span
              className={cn(
                "block truncate text-xs",
                variant === "sidebar"
                  ? "text-sidebar-foreground/55"
                  : "text-muted-foreground",
              )}
            >
              {email}
            </span>
          ) : null}
        </span>
        <ChevronDownIcon
          className={cn(
            "size-4 shrink-0",
            variant === "sidebar"
              ? "text-sidebar-foreground/60"
              : "opacity-70",
          )}
          aria-hidden
        />
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start" side="bottom">
        <PopoverHeader className="px-1">
          <PopoverTitle className="truncate text-base">{primary}</PopoverTitle>
          {email ? (
            <p className="truncate text-xs text-muted-foreground">{email}</p>
          ) : null}
        </PopoverHeader>
        <div className="mt-3 flex flex-col gap-1 border-t border-border pt-3">
          <Link
            href="/admin/account"
            className="flex h-9 items-center rounded-md px-3 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
            onClick={() => setOpen(false)}
          >
            Kelola akun…
          </Link>
          <Button
            variant="ghost"
            className="h-9 justify-start px-3 text-destructive hover:bg-destructive/10 hover:text-destructive"
            type="button"
            onClick={async () => {
              setOpen(false);
              await authClient.signOut();
              window.location.href = "/admin/sign-in";
            }}
          >
            Keluar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
