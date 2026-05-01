"use client";

import { motion, useReducedMotion } from "motion/react";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

export type RegistrationProgressStepMeta = {
  id: string;
  title: string;
};

type RegistrationProgressStepperProps = {
  steps: RegistrationProgressStepMeta[];
  /** Indeks aktif (0-based), selaras dengan `steps`. */
  activeIndex: number;
  className?: string;
  /** Tap pada bola langkah yang sudah dilewati melewati `onNavigateToStepIndex`. */
  allowNavigateToPastSteps?: boolean;
  onNavigateToStepIndex?: (index: number) => void;
};

function StepConnector({
  complete,
  reduceMotion,
}: {
  complete: boolean;
  reduceMotion: boolean;
}) {
  return (
    <div
      className="relative mx-2 h-1 min-w-5 flex-1 self-center overflow-hidden rounded-full bg-muted"
      aria-hidden="true"
    >
      <motion.div
        className="absolute inset-y-0 left-0 rounded-full bg-primary"
        initial={false}
        animate={{ width: complete ? "100%" : "0%" }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { duration: 0.38, ease: [0.32, 0.72, 0, 1] }
        }
      />
    </div>
  );
}

function StepIndicator({
  stepNumber,
  status,
  title,
  allowTap,
  onTap,
  reduceMotion,
}: {
  stepNumber: number;
  status: "complete" | "active" | "upcoming";
  title: string;
  allowTap: boolean;
  onTap: () => void;
  reduceMotion: boolean;
}) {
  const canTap =
    allowTap &&
    typeof onTap === "function" &&
    (status === "complete" || status === "active");

  const statusSr =
    status === "active"
      ? "langkah kini"
      : status === "complete"
        ? "selesai"
        : "belum tercapai";

  return (
    <motion.button
      type="button"
      initial={false}
      animate={
        reduceMotion ? undefined : { scale: status === "active" ? 1.04 : 1 }
      }
      transition={
        reduceMotion
          ? { duration: 0 }
          : { type: "spring", stiffness: 420, damping: 28 }
      }
      aria-label={`${title} (${statusSr})`}
      aria-current={status === "active" ? "step" : undefined}
      title={title}
      disabled={!canTap}
      onClick={canTap ? onTap : undefined}
      className={cn(
        "relative shrink-0 outline-none focus-visible:ring-4 focus-visible:ring-primary/30",
        canTap ? "cursor-pointer touch-manipulation" : "cursor-default"
      )}
    >
      <motion.div
        className={cn(
          "relative flex size-11 items-center justify-center rounded-full border-2 text-sm font-semibold shadow-sm motion-safe:transition-colors",
          status === "upcoming" &&
            "border-border bg-background text-muted-foreground",
          status === "complete" &&
            "border-primary bg-primary text-primary-foreground",
          status === "active" &&
            "border-primary bg-primary text-primary-foreground ring-4 ring-primary/25 ring-offset-2 ring-offset-background"
        )}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.28 }}
      >
        {status === "complete" ? (
          <Check className="size-5" strokeWidth={2.75} aria-hidden />
        ) : status === "active" ? (
          <span className="size-2.5 rounded-full bg-primary-foreground" />
        ) : (
          <span className="tabular-nums">{stepNumber}</span>
        )}
      </motion.div>
    </motion.button>
  );
}

/**
 * Jalur bola + konektor bergaya pola [React Bits Stepper](https://reactbits.dev/components/stepper)
 * menggunakan `motion`. Navigasi isi formulir tetap dikendalikan oleh induk.
 */
export function RegistrationProgressStepper({
  steps,
  activeIndex,
  className,
  allowNavigateToPastSteps = false,
  onNavigateToStepIndex,
}: RegistrationProgressStepperProps) {
  const reduceMotion = useReducedMotion() ?? false;

  return (
    <nav
      className={cn("w-full", className)}
      aria-label="Progres langkah formulir"
    >
      <div className="flex w-full flex-wrap items-center justify-between gap-y-3">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const status: "complete" | "active" | "upcoming" =
            index < activeIndex
              ? "complete"
              : index === activeIndex
                ? "active"
                : "upcoming";
          const isLast = index === steps.length - 1;

          return (
            <div
              key={step.id}
              className={cn("flex items-center", !isLast && "flex-1")}
            >
              <StepIndicator
                stepNumber={stepNumber}
                status={status}
                title={step.title}
                allowTap={Boolean(
                  allowNavigateToPastSteps && onNavigateToStepIndex
                )}
                reduceMotion={reduceMotion}
                onTap={() => {
                  if (index >= activeIndex || !onNavigateToStepIndex) return;
                  onNavigateToStepIndex(index);
                }}
              />
              {!isLast ? (
                <StepConnector
                  complete={activeIndex > index}
                  reduceMotion={reduceMotion}
                />
              ) : null}
              <span className="sr-only">
                Langkah {stepNumber}: {step.title}
              </span>
            </div>
          );
        })}
      </div>
      <span className="sr-only">
        Sekarang mengisi langkah ke-{activeIndex + 1}:{" "}
        {steps[activeIndex]?.title ?? ""}.
      </span>
    </nav>
  );
}
