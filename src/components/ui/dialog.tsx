import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

function Dialog({ open, onOpenChange, children }: DialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) onOpenChange(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={(e) => {
        if (e.target === overlayRef.current) onOpenChange(false);
      }}
    >
      {children}
    </div>
  );
}

function DialogContent({
  className,
  children,
  onClose,
}: {
  className?: string;
  children: ReactNode;
  onClose?: () => void;
}) {
  return (
    <div
      role="dialog"
      className={cn(
        "relative grid w-full max-w-lg max-h-[90vh] sm:max-h-[85vh] overflow-y-auto gap-4 rounded-t-2xl sm:rounded-2xl border bg-white p-5 sm:p-6 shadow-xl",
        className
      )}
    >
      {children}
      {onClose && (
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}

function DialogHeader({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>{children}</div>
  );
}

function DialogTitle({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <h3
      className={cn("text-lg font-semibold leading-none text-slate-900", className)}
      style={{ fontFamily: "'Instrument Serif', Georgia, serif" }}
    >
      {children}
    </h3>
  );
}

function DialogDescription({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <p className={cn("text-sm text-slate-500", className)}>{children}</p>
  );
}

function DialogFooter({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
    >
      {children}
    </div>
  );
}

export {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
};
