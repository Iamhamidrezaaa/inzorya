"use client";

import { usePageCopy } from "@/i18n/use-page-copy";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDownRight,
  ArrowUpRight,
  Download,
  Filter,
  Lightbulb,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { AnalyticsBundle } from "@/lib/analytics/mock-provider";
import {
  DonutChart,
  FunnelBars,
  HeatmapGrid,
  Sparkline,
  TrendChart,
} from "@/components/analytics/charts";

type Tab =
  | "overview"
  | "engagement"
  | "audience"
  | "content"
  | "campaigns"
  | "channels"
  | "growth"
  | "reports";

const RANGES = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "7d", label: "7D" },
  { id: "30d", label: "30D" },
  { id: "90d", label: "90D" },
  { id: "12m", label: "12M" },
  { id: "custom", label: "Custom" },
] as const;

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "engagement", label: "Engagement" },
  { id: "audience", label: "Audience" },
  { id: "content", label: "Content" },
  { id: "campaigns", label: "Campaigns" },
  { id: "channels", label: "Channels" },
  { id: "growth", label: "Growth" },
  { id: "reports", label: "Reports" },
];

function formatValue(value: number, unit: string) {
  if (unit === "currency") {
    return `$${value.toLocaleString()}`;
  }
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `${(value / 1000).toFixed(1)}K`;
  return value.toLocaleString();
}

export function AnalyticsView({
  workspaceSlug,
  brandSlug,
}: {
  workspaceSlug: string;
  brandSlug: string;
}) {
  const page = usePageCopy("analytics");
  const [tab, setTab] = useState<Tab>("overview");
  const [range, setRange] = useState("30d");
  const [compare, setCompare] = useState(true);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [q, setQ] = useState("");
  const [platform, setPlatform] = useState("");
  const [contentType, setContentType] = useState("");
  const [author, setAuthor] = useState("");
  const [status, setStatus] = useState("");
  const [campaign, setCampaign] = useState("");
  const [sortKey, setSortKey] = useState("engagement");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [data, setData] = useState<AnalyticsBundle | null>(null);
  const [reports, setReports] = useState<
    { id: string; name: string; rangeLabel: string | null; createdAt: string }[]
  >([]);
  const [templates, setTemplates] = useState<
    { id: string; name: string; description: string | null; metrics: string[]; charts: string[] }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [reportForm, setReportForm] = useState({
    name: "Weekly performance",
    metrics: ["followers", "reach", "engagement", "revenue"],
    charts: ["engagement", "growth", "funnel"],
  });

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      workspaceSlug,
      brandSlug,
      range,
      ...(range === "custom" && customStart ? { start: customStart } : {}),
      ...(range === "custom" && customEnd ? { end: customEnd } : {}),
      ...(q ? { q } : {}),
      ...(platform ? { platform } : {}),
      ...(contentType ? { contentType } : {}),
      ...(author ? { author } : {}),
      ...(status ? { status } : {}),
      ...(campaign ? { campaign } : {}),
    });
    const res = await fetch(`/api/analytics?${params}`);
    setLoading(false);
    if (!res.ok) {
      toast.error("Could not load analytics.");
      return;
    }
    const json = (await res.json()) as { analytics: AnalyticsBundle };
    setData(json.analytics);
  }, [
    workspaceSlug,
    brandSlug,
    range,
    customStart,
    customEnd,
    q,
    platform,
    contentType,
    author,
    status,
    campaign,
  ]);

  const loadReports = useCallback(async () => {
    const params = new URLSearchParams({
      workspaceSlug,
      brandSlug,
      view: "reports",
    });
    const res = await fetch(`/api/analytics?${params}`);
    if (!res.ok) return;
    const json = (await res.json()) as {
      reports: typeof reports;
      templates: typeof templates;
    };
    setReports(json.reports);
    setTemplates(json.templates);
  }, [workspaceSlug, brandSlug]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 120);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    if (tab === "reports") void loadReports();
  }, [tab, loadReports]);

  const sortedPosts = useMemo(() => {
    if (!data) return [];
    const posts = [...data.content.posts];
    posts.sort((a, b) => {
      const av = a[sortKey as keyof typeof a];
      const bv = b[sortKey as keyof typeof b];
      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av;
      }
      return sortDir === "asc"
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
    return posts;
  }, [data, sortKey, sortDir]);

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function exportCsv() {
    if (!data) return;
    const rows = [
      ["Title", "Platform", "Type", "Published", "Reach", "Likes", "Comments", "Shares", "Saves", "CTR", "Status"],
      ...sortedPosts.map((p) => [
        p.title,
        p.platform,
        p.contentType,
        p.publishedAt,
        p.reach,
        p.likes,
        p.comments,
        p.shares,
        p.saves,
        p.ctr,
        p.status,
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics-content-${data.range.end}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportPdf() {
    if (!data) return;
    const w = window.open("", "_blank");
    if (!w) {
      toast.error("Popup blocked.");
      return;
    }
    w.document.write(`<!doctype html><html><head><title>${reportForm.name}</title>
      <style>body{font-family:system-ui;padding:32px;color:#111}h1{font-size:22px}table{width:100%;border-collapse:collapse;margin-top:16px}td,th{border:1px solid #ddd;padding:8px;font-size:12px;text-align:left}.kpi{display:inline-block;margin:8px 12px 8px 0;padding:12px;border:1px solid #eee;border-radius:8px;min-width:120px}</style>
      </head><body>
      <h1>${reportForm.name}</h1>
      <p>${data.range.label}: ${data.range.start} → ${data.range.end}</p>
      ${data.kpis
        .filter((k) => reportForm.metrics.includes(k.key))
        .map(
          (k) =>
            `<div class="kpi"><strong>${k.label}</strong><div>${formatValue(k.current, k.unit)}</div><small>${k.changePct}%</small></div>`,
        )
        .join("")}
      <h2>Insights</h2>
      <ul>${data.insights.map((i) => `<li><strong>${i.title}</strong> — ${i.body}</li>`).join("")}</ul>
      </body></html>`);
    w.document.close();
    w.focus();
    w.print();
  }

  async function saveReport() {
    const res = await fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: "save_report",
        workspaceSlug,
        brandSlug,
        name: reportForm.name,
        rangeLabel: data?.range.label,
        metrics: reportForm.metrics,
        charts: reportForm.charts,
        payload: { range: data?.range, kpiCount: data?.kpis.length },
      }),
    });
    if (!res.ok) {
      toast.error("Could not save report.");
      return;
    }
    toast.success("Report saved.");
    await loadReports();
  }

  async function saveTemplate() {
    const res = await fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: "save_template",
        workspaceSlug,
        brandSlug,
        name: `${reportForm.name} template`,
        description: "Saved from report builder",
        metrics: reportForm.metrics,
        charts: reportForm.charts,
      }),
    });
    if (!res.ok) {
      toast.error("Could not save template.");
      return;
    }
    toast.success("Template saved.");
    await loadReports();
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={page.title}
        description={page.description}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={exportCsv}>
              <Download className="h-4 w-4" />
              CSV
            </Button>
            <Button size="sm" variant="outline" onClick={exportPdf}>
              <Download className="h-4 w-4" />
              PDF
            </Button>
          </div>
        }
      />

      <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card/30 p-3 lg:flex-row lg:items-center">
        <div className="flex flex-wrap gap-1">
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRange(r.id)}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-xs font-medium",
                range === r.id
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-accent/50",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
        {range === "custom" ? (
          <div className="flex gap-2">
            <Input
              type="date"
              className="h-8 w-auto"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
            />
            <Input
              type="date"
              className="h-8 w-auto"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
            />
          </div>
        ) : null}
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={compare}
            onChange={(e) => setCompare(e.target.checked)}
          />
          Comparison mode
        </label>
        <div className="relative ml-auto w-full max-w-xs">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="h-8 pl-8 text-xs"
            placeholder="Search posts, campaigns…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
        <select
          className="h-8 rounded-md border border-border bg-background px-2"
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
        >
          <option value="">Platform</option>
          <option value="INSTAGRAM">Instagram</option>
          <option value="FACEBOOK">Facebook</option>
          <option value="MESSENGER">Messenger</option>
        </select>
        <select
          className="h-8 rounded-md border border-border bg-background px-2"
          value={contentType}
          onChange={(e) => setContentType(e.target.value)}
        >
          <option value="">Content type</option>
          <option value="post">Post</option>
          <option value="reel">Reel</option>
          <option value="story">Story</option>
          <option value="carousel">Carousel</option>
        </select>
        <select
          className="h-8 rounded-md border border-border bg-background px-2"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
        >
          <option value="">Author</option>
          <option value="Sarah">Sarah</option>
          <option value="Alex">Alex</option>
          <option value="Studio">Studio</option>
        </select>
        <select
          className="h-8 rounded-md border border-border bg-background px-2"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Status</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
        </select>
        <select
          className="h-8 rounded-md border border-border bg-background px-2"
          value={campaign}
          onChange={(e) => setCampaign(e.target.value)}
        >
          <option value="">Campaign</option>
          {data?.campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-lg border border-border/70 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "shrink-0 rounded-md px-3 py-1.5 text-xs font-medium",
              tab === t.id
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/40",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading || !data ? (
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-5">
            {tab === "overview" ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {data.kpis.map((kpi) => {
                    const up = kpi.changePct >= 0;
                    return (
                      <div
                        key={kpi.key}
                        className="rounded-xl border border-border/70 bg-card/40 p-4 transition hover:border-primary/30"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-xs text-muted-foreground">
                            {kpi.label}
                          </div>
                          <Badge
                            variant="muted"
                            className={cn(
                              "text-[10px]",
                              up ? "text-emerald-400" : "text-rose-400",
                            )}
                          >
                            {up ? (
                              <ArrowUpRight className="mr-0.5 inline h-3 w-3" />
                            ) : (
                              <ArrowDownRight className="mr-0.5 inline h-3 w-3" />
                            )}
                            {Math.abs(kpi.changePct)}%
                          </Badge>
                        </div>
                        <div className="mt-2 text-2xl font-semibold tracking-tight">
                          {formatValue(kpi.current, kpi.unit)}
                        </div>
                        {compare ? (
                          <div className="mt-1 text-[11px] text-muted-foreground">
                            Prev {formatValue(kpi.previous, kpi.unit)} ·{" "}
                            {data.range.compareStart}→{data.range.compareEnd}
                          </div>
                        ) : null}
                        <div className="mt-2">
                          <Sparkline data={kpi.sparkline} positive={up} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <Panel title="Reach vs engagement">
                  <TrendChart
                    data={data.engagement.daily}
                    xKey="date"
                    series={[
                      { key: "reach", color: "#38bdf8", name: "Reach" },
                      { key: "engagement", color: "#14b8a6", name: "Engagement" },
                    ]}
                  />
                </Panel>
                <div className="grid gap-4 lg:grid-cols-2">
                  <Panel title="Conversion funnel (mock)">
                    <FunnelBars data={data.funnel} />
                  </Panel>
                  <Panel title="Posting time heatmap">
                    <HeatmapGrid data={data.heatmap} />
                  </Panel>
                </div>
              </>
            ) : null}

            {tab === "engagement" ? (
              <div className="space-y-4">
                <Panel title="Daily engagement">
                  <TrendChart
                    data={data.engagement.daily}
                    xKey="date"
                    series={[
                      { key: "engagement", color: "#14b8a6", name: "Engagement" },
                      { key: "rate", color: "#a78bfa", name: "Rate %" },
                    ]}
                  />
                </Panel>
                <div className="grid gap-4 lg:grid-cols-2">
                  <Panel title="Weekly engagement">
                    <TrendChart
                      type="bar"
                      data={data.engagement.weekly}
                      xKey="label"
                      series={[{ key: "engagement", color: "#14b8a6" }]}
                    />
                  </Panel>
                  <Panel title="Monthly engagement">
                    <TrendChart
                      type="bar"
                      data={data.engagement.monthly}
                      xKey="label"
                      series={[{ key: "engagement", color: "#38bdf8" }]}
                    />
                  </Panel>
                </div>
              </div>
            ) : null}

            {tab === "audience" ? (
              <div className="space-y-4">
                <Panel title="Followers growth">
                  <TrendChart
                    data={data.audience.followersGrowth}
                    xKey="date"
                    type="line"
                    series={[{ key: "followers", color: "#14b8a6" }]}
                  />
                </Panel>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <Panel title="Location">
                    <DonutChart data={data.audience.locations} />
                  </Panel>
                  <Panel title="Age">
                    <DonutChart data={data.audience.ages} />
                  </Panel>
                  <Panel title="Gender">
                    <DonutChart data={data.audience.genders} />
                  </Panel>
                  <Panel title="Languages">
                    <DonutChart data={data.audience.languages} />
                  </Panel>
                  <Panel title="Devices">
                    <DonutChart data={data.audience.devices} />
                  </Panel>
                  <Panel title="Active hours">
                    <HeatmapGrid data={data.heatmap} />
                  </Panel>
                </div>
              </div>
            ) : null}

            {tab === "content" ? (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Stat
                    label="Avg engagement"
                    value={data.content.averages.engagement.toLocaleString()}
                  />
                  <Stat
                    label="Avg reach"
                    value={data.content.averages.reach.toLocaleString()}
                  />
                  <Stat
                    label="Avg saves"
                    value={data.content.averages.saves.toLocaleString()}
                  />
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                  <Panel title="Top formats">
                    <TopList label="Posts" items={data.content.top.posts} />
                    <TopList label="Reels" items={data.content.top.reels} />
                    <TopList label="Stories" items={data.content.top.stories} />
                    <TopList
                      label="Carousels"
                      items={data.content.top.carousels}
                    />
                  </Panel>
                  <Panel title="Worst performing">
                    <TopList label="Needs attention" items={data.content.worst} />
                  </Panel>
                </div>
                <Panel title="Content performance">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] text-left text-xs">
                      <thead className="border-b border-border text-muted-foreground">
                        <tr>
                          {[
                            ["title", "Title"],
                            ["platform", "Platform"],
                            ["publishedAt", "Published"],
                            ["reach", "Reach"],
                            ["likes", "Likes"],
                            ["comments", "Comments"],
                            ["shares", "Shares"],
                            ["saves", "Saves"],
                            ["ctr", "CTR"],
                            ["status", "Status"],
                          ].map(([key, label]) => (
                            <th key={key} className="px-2 py-2 font-medium">
                              <button type="button" onClick={() => toggleSort(key)}>
                                {label}
                                {sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                              </button>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sortedPosts.map((p) => (
                          <tr
                            key={p.id}
                            className="border-b border-border/50 hover:bg-accent/30"
                          >
                            <td className="px-2 py-2 font-medium">{p.title}</td>
                            <td className="px-2 py-2">{p.platform}</td>
                            <td className="px-2 py-2">{p.publishedAt}</td>
                            <td className="px-2 py-2">{p.reach.toLocaleString()}</td>
                            <td className="px-2 py-2">{p.likes.toLocaleString()}</td>
                            <td className="px-2 py-2">{p.comments.toLocaleString()}</td>
                            <td className="px-2 py-2">{p.shares.toLocaleString()}</td>
                            <td className="px-2 py-2">{p.saves.toLocaleString()}</td>
                            <td className="px-2 py-2">{p.ctr}%</td>
                            <td className="px-2 py-2">
                              <Badge variant="muted">{p.status}</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              </div>
            ) : null}

            {tab === "campaigns" ? (
              <div className="space-y-4">
                <Panel title="Campaign comparison">
                  <TrendChart
                    type="bar"
                    data={data.campaigns.map((c) => ({
                      name: c.name,
                      reach: c.reach,
                      engagement: c.engagement,
                      clicks: c.clicks,
                      conversions: c.conversions,
                    }))}
                    xKey="name"
                    series={[
                      { key: "reach", color: "#38bdf8", name: "Reach" },
                      { key: "engagement", color: "#14b8a6", name: "Engagement" },
                      { key: "clicks", color: "#a78bfa", name: "Clicks" },
                      { key: "conversions", color: "#f59e0b", name: "Conversions" },
                    ]}
                  />
                </Panel>
                <div className="grid gap-3 md:grid-cols-3">
                  {data.campaigns.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-xl border border-border/70 bg-card/40 p-4"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium">{c.name}</h3>
                        <Badge variant="muted">{c.status}</Badge>
                      </div>
                      <dl className="mt-3 space-y-1 text-xs text-muted-foreground">
                        <div className="flex justify-between">
                          <dt>Reach</dt>
                          <dd className="text-foreground">{c.reach.toLocaleString()}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt>Engagement</dt>
                          <dd className="text-foreground">
                            {c.engagement.toLocaleString()}
                          </dd>
                        </div>
                        <div className="flex justify-between">
                          <dt>Clicks</dt>
                          <dd className="text-foreground">{c.clicks.toLocaleString()}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt>Conversions</dt>
                          <dd className="text-foreground">
                            {c.conversions.toLocaleString()}
                          </dd>
                        </div>
                        <div className="flex justify-between">
                          <dt>ROI (mock)</dt>
                          <dd className="text-foreground">{c.roi}x</dd>
                        </div>
                      </dl>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {tab === "channels" ? (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  {data.channels.map((ch) => (
                    <div
                      key={ch.platform}
                      className="rounded-xl border border-border/70 bg-card/40 p-4"
                    >
                      <h3 className="font-medium">{ch.platform}</h3>
                      <dl className="mt-3 space-y-1 text-xs">
                        <Row label="Followers" value={ch.followers} />
                        <Row label="Reach" value={ch.reach} />
                        <Row label="Impressions" value={ch.impressions} />
                        <Row label="Engagement" value={ch.engagement} />
                        <Row label="Messages" value={ch.messages} />
                        <Row label="Profile visits" value={ch.profileVisits} />
                      </dl>
                    </div>
                  ))}
                </div>
                <Panel title="Channel reach comparison">
                  <TrendChart
                    data={mergeChannelSeries(data.channels)}
                    xKey="date"
                    series={data.channels.map((c, i) => ({
                      key: c.platform,
                      color: ["#14b8a6", "#38bdf8", "#a78bfa"][i]!,
                    }))}
                  />
                </Panel>
              </div>
            ) : null}

            {tab === "growth" ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <Panel title="Follower growth">
                  <TrendChart
                    type="line"
                    data={data.growth.followers}
                    xKey="date"
                    series={[{ key: "value", color: "#14b8a6", name: "Followers" }]}
                  />
                </Panel>
                <Panel title="Reach growth">
                  <TrendChart
                    data={data.growth.reach}
                    xKey="date"
                    series={[{ key: "value", color: "#38bdf8", name: "Reach" }]}
                  />
                </Panel>
                <Panel title="Engagement growth">
                  <TrendChart
                    data={data.growth.engagement}
                    xKey="date"
                    series={[{ key: "value", color: "#a78bfa", name: "Engagement" }]}
                  />
                </Panel>
                <Panel title="Content production growth">
                  <TrendChart
                    type="bar"
                    data={data.growth.content}
                    xKey="date"
                    series={[{ key: "value", color: "#f59e0b", name: "Posts" }]}
                  />
                </Panel>
              </div>
            ) : null}

            {tab === "reports" ? (
              <div className="space-y-4">
                <Panel title="Report builder">
                  <div className="grid gap-3 md:grid-cols-2">
                    <Input
                      value={reportForm.name}
                      onChange={(e) =>
                        setReportForm((f) => ({ ...f, name: e.target.value }))
                      }
                      placeholder="Report name"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => void saveReport()}>
                        Save report
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void saveTemplate()}
                      >
                        Save template
                      </Button>
                      <Button size="sm" variant="outline" onClick={exportPdf}>
                        Export PDF
                      </Button>
                      <Button size="sm" variant="outline" onClick={exportCsv}>
                        Export CSV
                      </Button>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="mb-2 text-xs font-medium text-muted-foreground">
                        Metrics
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {data.kpis.map((k) => {
                          const on = reportForm.metrics.includes(k.key);
                          return (
                            <button
                              key={k.key}
                              type="button"
                              className={cn(
                                "rounded-md border px-2 py-1 text-[11px]",
                                on
                                  ? "border-primary/40 bg-primary/10 text-primary"
                                  : "border-border text-muted-foreground",
                              )}
                              onClick={() =>
                                setReportForm((f) => ({
                                  ...f,
                                  metrics: on
                                    ? f.metrics.filter((m) => m !== k.key)
                                    : [...f.metrics, k.key],
                                }))
                              }
                            >
                              {k.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-medium text-muted-foreground">
                        Charts
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {["engagement", "growth", "funnel", "heatmap", "content"].map(
                          (c) => {
                            const on = reportForm.charts.includes(c);
                            return (
                              <button
                                key={c}
                                type="button"
                                className={cn(
                                  "rounded-md border px-2 py-1 text-[11px] capitalize",
                                  on
                                    ? "border-primary/40 bg-primary/10 text-primary"
                                    : "border-border text-muted-foreground",
                                )}
                                onClick={() =>
                                  setReportForm((f) => ({
                                    ...f,
                                    charts: on
                                      ? f.charts.filter((x) => x !== c)
                                      : [...f.charts, c],
                                  }))
                                }
                              >
                                {c}
                              </button>
                            );
                          },
                        )}
                      </div>
                    </div>
                  </div>
                </Panel>
                <div className="grid gap-4 md:grid-cols-2">
                  <Panel title="Saved reports">
                    {reports.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No reports yet.</p>
                    ) : (
                      <ul className="space-y-2 text-sm">
                        {reports.map((r) => (
                          <li
                            key={r.id}
                            className="rounded-lg border border-border/60 px-3 py-2"
                          >
                            <div className="font-medium">{r.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {r.rangeLabel || "—"}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Panel>
                  <Panel title="Templates">
                    <ul className="space-y-2 text-sm">
                      {templates.map((t) => (
                        <li
                          key={t.id}
                          className="rounded-lg border border-border/60 px-3 py-2"
                        >
                          <button
                            type="button"
                            className="w-full text-left"
                            onClick={() =>
                              setReportForm({
                                name: t.name,
                                metrics: t.metrics,
                                charts: t.charts,
                              })
                            }
                          >
                            <div className="font-medium">{t.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {t.description}
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </Panel>
                </div>
              </div>
            ) : null}
          </div>

          <aside className="space-y-3 xl:sticky xl:top-4 xl:self-start">
            <div className="rounded-xl border border-border/70 bg-card/50 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Lightbulb className="h-4 w-4 text-amber-400" />
                Insight panel
              </div>
              <p className="mb-3 text-[11px] text-muted-foreground">
                Deterministic rules only — reserved for future AI consumption.
              </p>
              <div className="max-h-[70vh] space-y-2 overflow-y-auto">
                {data.insights.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No notable changes in this range.
                  </p>
                ) : (
                  data.insights.map((ins, i) => (
                    <div
                      key={`${ins.ruleKey}-${i}`}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-xs",
                        ins.severity === "warning"
                          ? "border-rose-500/30 bg-rose-500/5"
                          : ins.severity === "positive"
                            ? "border-emerald-500/30 bg-emerald-500/5"
                            : "border-border/60 bg-background/40",
                      )}
                    >
                      <div className="font-medium">{ins.title}</div>
                      <p className="mt-1 text-muted-foreground">{ins.body}</p>
                      <div className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {ins.kind} · {ins.ruleKey}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border/70 bg-card/40 p-4">
      <h2 className="mb-3 text-sm font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-card/40 p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}

function TopList({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="mb-3">
      <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <ol className="space-y-1 text-sm">
        {items.map((item, i) => (
          <li key={item} className="truncate text-muted-foreground">
            <span className="text-foreground">{i + 1}.</span> {item}
          </li>
        ))}
      </ol>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-muted-foreground">
      <span>{label}</span>
      <span className="text-foreground">{value.toLocaleString()}</span>
    </div>
  );
}

function mergeChannelSeries(
  channels: AnalyticsBundle["channels"],
): Record<string, string | number>[] {
  const map = new Map<string, Record<string, string | number>>();
  for (const ch of channels) {
    for (const point of ch.series) {
      const row = map.get(point.date) || { date: point.date };
      row[ch.platform] = point.reach;
      map.set(point.date, row);
    }
  }
  return Array.from(map.values());
}
