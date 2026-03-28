import { useEffect, useState } from "react";
import { generateInsights, clearInsightsCache, type Insight } from "@/lib/insights";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Lightbulb,
  RefreshCw,
  Sparkles,
} from "lucide-react";

const serif = { fontFamily: "'Instrument Serif', Georgia, serif" };

const typeConfig: Record<
  Insight["type"],
  { icon: typeof Info; bg: string; iconBg: string; iconColor: string; border: string }
> = {
  warning: {
    icon: AlertTriangle,
    bg: "bg-amber-50",
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
    border: "border-amber-100",
  },
  success: {
    icon: CheckCircle2,
    bg: "bg-emerald-50",
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-600",
    border: "border-emerald-100",
  },
  info: {
    icon: Info,
    bg: "bg-blue-50",
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
    border: "border-blue-100",
  },
  suggestion: {
    icon: Lightbulb,
    bg: "bg-violet-50",
    iconBg: "bg-violet-100",
    iconColor: "text-violet-600",
    border: "border-violet-100",
  },
};

interface Props {
  supervisorId: string;
}

export function InsightsPanel({ supervisorId }: Props) {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const result = await generateInsights(supervisorId);
      setInsights(result);
    } catch (err) {
      console.error("Insights load error:", err);
      setInsights([]);
    } finally {
      setLoading(false);
    }
  };

  const regenerate = async () => {
    setRegenerating(true);
    try {
      await clearInsightsCache(supervisorId);
      const result = await generateInsights(supervisorId);
      setInsights(result);
    } catch (err) {
      console.error("Insights regenerate error:", err);
    } finally {
      setRegenerating(false);
    }
  };

  useEffect(() => {
    if (supervisorId) load();
  }, [supervisorId]);

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-amber-500 animate-pulse" />
          <span className="text-sm font-medium text-slate-500">Generando insights...</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl border border-slate-100 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <div className="size-9 rounded-lg bg-slate-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-2/3 rounded bg-slate-100" />
                  <div className="h-3 w-full rounded bg-slate-50" />
                  <div className="h-3 w-4/5 rounded bg-slate-50" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (insights.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-amber-500" />
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
            Insights con IA
          </h2>
        </div>
        <button
          onClick={regenerate}
          disabled={regenerating}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
        >
          <RefreshCw className={`size-3 ${regenerating ? "animate-spin" : ""}`} />
          {regenerating ? "Regenerando..." : "Regenerar"}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {insights.map((insight, i) => {
          const config = typeConfig[insight.type] || typeConfig.info;
          const Icon = config.icon;
          return (
            <div
              key={i}
              className={`rounded-xl border ${config.border} ${config.bg} p-4 transition-shadow hover:shadow-md`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${config.iconBg}`}
                >
                  <Icon className={`size-4 ${config.iconColor}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3
                    className="text-sm font-semibold text-slate-800 leading-tight"
                    style={serif}
                  >
                    {insight.title}
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">
                    {insight.description}
                  </p>
                  {insight.building_name && (
                    <span className="mt-1.5 inline-block rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                      {insight.building_name}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
