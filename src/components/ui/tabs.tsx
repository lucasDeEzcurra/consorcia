import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

interface TabsContextValue {
  value: string;
  onValueChange: (value: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function Tabs({
  defaultValue,
  value: controlledValue,
  onValueChange,
  className,
  children,
}: {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  children: ReactNode;
}) {
  const [uncontrolled, setUncontrolled] = useState(defaultValue ?? "");
  const value = controlledValue ?? uncontrolled;
  const setValue = onValueChange ?? setUncontrolled;

  return (
    <TabsContext.Provider value={{ value, onValueChange: setValue }}>
      <div data-slot="tabs" className={cn("flex flex-col gap-3", className)}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

function TabsList({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      data-slot="tabs-list"
      role="tablist"
      className={cn(
        "inline-flex h-10 w-fit items-center justify-center rounded-xl bg-slate-100 p-1 text-slate-500",
        className
      )}
    >
      {children}
    </div>
  );
}

function TabsTrigger({
  value,
  className,
  children,
}: {
  value: string;
  className?: string;
  children: ReactNode;
}) {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("TabsTrigger must be inside Tabs");
  const isActive = ctx.value === value;

  return (
    <button
      role="tab"
      aria-selected={isActive}
      data-state={isActive ? "active" : "inactive"}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/30",
        isActive
          ? "bg-white text-slate-900 shadow-sm"
          : "hover:text-slate-700",
        className
      )}
      onClick={() => ctx.onValueChange(value)}
    >
      {children}
    </button>
  );
}

function TabsContent({
  value,
  className,
  children,
}: {
  value: string;
  className?: string;
  children: ReactNode;
}) {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("TabsContent must be inside Tabs");
  if (ctx.value !== value) return null;

  return (
    <div data-slot="tabs-content" className={cn("text-sm", className)}>
      {children}
    </div>
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
