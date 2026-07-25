"use client";

import { memo, useMemo } from "react";
import {
  Handle,
  Position,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import {
  Clock,
  GitBranch,
  OctagonX,
  Split,
  Zap,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type FlowNodeData = {
  kind: string;
  label: string;
  description?: string | null;
  config: Record<string, unknown>;
  nodeType: "TRIGGER" | "CONDITION" | "ACTION" | "DELAY" | "BRANCH" | "END";
  invalid?: boolean;
};

export type FlowNode = Node<FlowNodeData, "automation">;

const TYPE_META: Record<
  string,
  { icon: typeof Zap; accent: string; ring: string }
> = {
  TRIGGER: {
    icon: Zap,
    accent: "from-sky-500/20 to-sky-500/5 border-sky-500/40",
    ring: "ring-sky-400/50",
  },
  CONDITION: {
    icon: Filter,
    accent: "from-violet-500/20 to-violet-500/5 border-violet-500/40",
    ring: "ring-violet-400/50",
  },
  ACTION: {
    icon: Split,
    accent: "from-teal-500/20 to-teal-500/5 border-teal-500/40",
    ring: "ring-teal-400/50",
  },
  DELAY: {
    icon: Clock,
    accent: "from-amber-500/20 to-amber-500/5 border-amber-500/40",
    ring: "ring-amber-400/50",
  },
  BRANCH: {
    icon: GitBranch,
    accent: "from-fuchsia-500/20 to-fuchsia-500/5 border-fuchsia-500/40",
    ring: "ring-fuchsia-400/50",
  },
  END: {
    icon: OctagonX,
    accent: "from-rose-500/20 to-rose-500/5 border-rose-500/40",
    ring: "ring-rose-400/50",
  },
};

function AutomationNodeComponent({ data, selected }: NodeProps<FlowNode>) {
  const meta = TYPE_META[data.nodeType] || TYPE_META.ACTION;
  const Icon = meta.icon;
  const isCondition = data.nodeType === "CONDITION" || data.nodeType === "BRANCH";

  return (
    <div
      className={cn(
        "min-w-[180px] rounded-xl border bg-gradient-to-b px-3 py-2.5 shadow-lg backdrop-blur transition-all duration-200",
        meta.accent,
        selected && `ring-2 ${meta.ring} scale-[1.02]`,
        data.invalid && "border-rose-500 ring-2 ring-rose-500/60",
      )}
    >
      {data.nodeType !== "TRIGGER" ? (
        <Handle
          type="target"
          position={Position.Left}
          className="!h-2.5 !w-2.5 !border-background !bg-primary"
        />
      ) : null}
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-background/50">
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{data.label}</div>
          <div className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">
            {data.nodeType}
          </div>
        </div>
      </div>
      {data.description ? (
        <p className="mt-1.5 line-clamp-2 text-[11px] text-muted-foreground">
          {data.description}
        </p>
      ) : null}
      {isCondition ? (
        <>
          <Handle
            type="source"
            position={Position.Right}
            id="yes"
            className="!top-[35%] !h-2.5 !w-2.5 !border-background !bg-emerald-400"
          />
          <Handle
            type="source"
            position={Position.Right}
            id="no"
            className="!top-[70%] !h-2.5 !w-2.5 !border-background !bg-rose-400"
          />
          <div className="mt-2 flex justify-between text-[9px] text-muted-foreground">
            <span />
            <span className="flex flex-col items-end gap-2 pr-1">
              <span>Yes</span>
              <span>No</span>
            </span>
          </div>
        </>
      ) : data.nodeType !== "END" ? (
        <Handle
          type="source"
          position={Position.Right}
          className="!h-2.5 !w-2.5 !border-background !bg-primary"
        />
      ) : null}
    </div>
  );
}

export const AutomationFlowNode = memo(AutomationNodeComponent);

export const nodeTypes = {
  automation: AutomationFlowNode,
};

export function usePalette() {
  return useMemo(
    () => [
      { group: "Triggers", type: "TRIGGER" as const },
      { group: "Conditions", type: "CONDITION" as const },
      { group: "Actions", type: "ACTION" as const },
      { group: "Flow", type: "DELAY" as const },
    ],
    [],
  );
}
