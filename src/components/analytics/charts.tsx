"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";

const TOOLTIP_STYLE = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
};

export function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
  const chartData = data.map((v, i) => ({ i, v }));
  return (
    <div className="h-10 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData}>
          <Area
            type="monotone"
            dataKey="v"
            stroke={positive ? "#34d399" : "#fb7185"}
            fill={positive ? "rgba(52,211,153,0.15)" : "rgba(251,113,133,0.15)"}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TrendChart({
  data,
  xKey,
  series,
  type = "area",
}: {
  data: Record<string, string | number>[];
  xKey: string;
  series: { key: string; color: string; name?: string }[];
  type?: "area" | "line" | "bar";
}) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        {type === "bar" ? (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey={xKey} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
            <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend />
            {series.map((s) => (
              <Bar key={s.key} dataKey={s.key} name={s.name || s.key} fill={s.color} radius={4} />
            ))}
          </BarChart>
        ) : type === "line" ? (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey={xKey} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
            <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend />
            {series.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name || s.key}
                stroke={s.color}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        ) : (
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey={xKey} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
            <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend />
            {series.map((s) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name || s.key}
                stroke={s.color}
                fill={`${s.color}33`}
                strokeWidth={2}
              />
            ))}
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

const PIE_COLORS = ["#14b8a6", "#38bdf8", "#a78bfa", "#f59e0b", "#f43f5e", "#94a3b8"];

export function DonutChart({
  data,
}: {
  data: { name: string; value: number }[];
}) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={48}
            outerRadius={78}
            paddingAngle={2}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function HeatmapGrid({
  data,
}: {
  data: { day: string; hours: number[] }[];
}) {
  const max = Math.max(...data.flatMap((d) => d.hours), 1);
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px] space-y-1">
        {data.map((row) => (
          <div key={row.day} className="flex items-center gap-1">
            <span className="w-8 text-[10px] text-muted-foreground">{row.day}</span>
            <div
              className="grid flex-1 gap-0.5"
              style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}
            >
              {row.hours.map((v, h) => (
                <div
                  key={h}
                  title={`${row.day} ${h}:00 — ${v}`}
                  className={cn("h-4 rounded-sm")}
                  style={{
                    background: `rgba(20,184,166,${0.12 + (v / max) * 0.88})`,
                  }}
                />
              ))}
            </div>
          </div>
        ))}
        <div className="flex gap-1 pl-9 text-[9px] text-muted-foreground">
          {Array.from({ length: 24 }, (_, h) => (
            <span key={h} className="flex-1 text-center">
              {h % 3 === 0 ? h : ""}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function FunnelBars({
  data,
}: {
  data: { stage: string; value: number }[];
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="space-y-3">
      {data.map((step, i) => (
        <div key={step.stage}>
          <div className="mb-1 flex justify-between text-xs">
            <span>
              {i + 1}. {step.stage}
            </span>
            <span className="font-medium">{step.value.toLocaleString()}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${(step.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
