export type NodeKindDef = {
  kind: string;
  label: string;
  description: string;
  type: "TRIGGER" | "CONDITION" | "ACTION" | "DELAY" | "BRANCH" | "END";
  disabled?: boolean;
  fields?: { key: string; label: string; placeholder?: string; type?: "text" | "number" | "select"; options?: string[] }[];
};

export const TRIGGER_KINDS: NodeKindDef[] = [
  {
    kind: "INSTAGRAM_COMMENT",
    label: "Instagram Comment",
    description: "When someone comments on a post or reel.",
    type: "TRIGGER",
    fields: [{ key: "postId", label: "Post ID (mock)", placeholder: "optional" }],
  },
  {
    kind: "INSTAGRAM_DM",
    label: "Instagram DM",
    description: "When a DM is received.",
    type: "TRIGGER",
  },
  {
    kind: "FACEBOOK_MESSAGE",
    label: "Facebook Message",
    description: "When a Facebook/Messenger message arrives.",
    type: "TRIGGER",
  },
  {
    kind: "WHATSAPP_MESSAGE",
    label: "WhatsApp Message",
    description: "When a WhatsApp message is received.",
    type: "TRIGGER",
  },
  {
    kind: "NEW_FOLLOWER",
    label: "New Follower",
    description: "When someone follows the account.",
    type: "TRIGGER",
  },
  {
    kind: "KEYWORD",
    label: "Keyword",
    description: "When a message contains a keyword.",
    type: "TRIGGER",
    fields: [{ key: "keyword", label: "Keyword", placeholder: "e.g. price" }],
  },
  {
    kind: "MANUAL",
    label: "Manual Trigger",
    description: "Start this workflow manually.",
    type: "TRIGGER",
  },
  {
    kind: "SCHEDULE",
    label: "Schedule",
    description: "Run on a cron-like schedule (mock).",
    type: "TRIGGER",
    fields: [{ key: "cron", label: "Schedule", placeholder: "0 9 * * *" }],
  },
  {
    kind: "WEBHOOK",
    label: "Webhook",
    description: "Incoming webhook — disabled for now.",
    type: "TRIGGER",
    disabled: true,
  },
];

export const CONDITION_KINDS: NodeKindDef[] = [
  { kind: "CONTAINS_TEXT", label: "Contains Text", description: "Message contains text.", type: "CONDITION", fields: [{ key: "value", label: "Text" }] },
  { kind: "EQUALS", label: "Equals", description: "Exact match.", type: "CONDITION", fields: [{ key: "value", label: "Value" }] },
  { kind: "STARTS_WITH", label: "Starts With", description: "Starts with value.", type: "CONDITION", fields: [{ key: "value", label: "Prefix" }] },
  { kind: "ENDS_WITH", label: "Ends With", description: "Ends with value.", type: "CONDITION", fields: [{ key: "value", label: "Suffix" }] },
  { kind: "HAS_TAG", label: "Has Tag", description: "Contact has tag.", type: "CONDITION", fields: [{ key: "tag", label: "Tag" }] },
  { kind: "LANGUAGE", label: "Language", description: "Contact language.", type: "CONDITION", fields: [{ key: "language", label: "Language", placeholder: "en" }] },
  { kind: "PLATFORM", label: "Platform", description: "Source platform.", type: "CONDITION", fields: [{ key: "platform", label: "Platform", type: "select", options: ["INSTAGRAM", "FACEBOOK", "WHATSAPP", "TELEGRAM"] }] },
  { kind: "BUSINESS_HOURS", label: "Business Hours", description: "Within business hours.", type: "CONDITION" },
];

export const ACTION_KINDS: NodeKindDef[] = [
  { kind: "SEND_MESSAGE", label: "Send Message", description: "Send a reply (mock).", type: "ACTION", fields: [{ key: "message", label: "Message" }] },
  { kind: "ADD_TAG", label: "Add Tag", description: "Add a tag.", type: "ACTION", fields: [{ key: "tag", label: "Tag" }] },
  { kind: "REMOVE_TAG", label: "Remove Tag", description: "Remove a tag.", type: "ACTION", fields: [{ key: "tag", label: "Tag" }] },
  { kind: "ASSIGN_CONVERSATION", label: "Assign Conversation", description: "Assign to agent.", type: "ACTION", fields: [{ key: "agent", label: "Agent", placeholder: "me" }] },
  { kind: "CREATE_NOTE", label: "Create Note", description: "Internal note.", type: "ACTION", fields: [{ key: "note", label: "Note" }] },
  { kind: "MOVE_PIPELINE", label: "Move Pipeline", description: "Move lead stage.", type: "ACTION", fields: [{ key: "stage", label: "Stage" }] },
  { kind: "NOTIFY_USER", label: "Notify User", description: "Notify teammate.", type: "ACTION", fields: [{ key: "user", label: "User" }] },
  { kind: "WAIT", label: "Wait", description: "Wait before next step.", type: "DELAY", fields: [{ key: "seconds", label: "Seconds", type: "number", placeholder: "60" }] },
  { kind: "END_WORKFLOW", label: "End Workflow", description: "Stop the flow.", type: "END" },
];

export const STRUCTURAL_KINDS: NodeKindDef[] = [
  { kind: "BRANCH", label: "Branch", description: "Split into yes / no paths.", type: "BRANCH" },
  { kind: "DELAY", label: "Delay", description: "Pause the flow.", type: "DELAY", fields: [{ key: "seconds", label: "Seconds", type: "number", placeholder: "30" }] },
  { kind: "END", label: "End", description: "Terminal node.", type: "END" },
];

export const ALL_NODE_KINDS = [
  ...TRIGGER_KINDS,
  ...CONDITION_KINDS,
  ...ACTION_KINDS,
  ...STRUCTURAL_KINDS,
];

export function findKind(kind: string) {
  return ALL_NODE_KINDS.find((k) => k.kind === kind);
}

export type FlowSnapshot = {
  nodes: {
    id: string;
    type: string;
    kind: string;
    label: string;
    description?: string | null;
    config: Record<string, unknown>;
    position: { x: number; y: number };
  }[];
  edges: {
    id: string;
    source: string;
    target: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
    label?: string | null;
  }[];
};

export const AUTOMATION_TEMPLATES: {
  slug: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  snapshot: FlowSnapshot;
}[] = [
  {
    slug: "welcome-message",
    name: "Welcome Message",
    description: "Greet new DMs with a welcome reply.",
    category: "Engagement",
    tags: ["welcome", "dm"],
    snapshot: {
      nodes: [
        { id: "t1", type: "TRIGGER", kind: "INSTAGRAM_DM", label: "Instagram DM", config: {}, position: { x: 80, y: 120 } },
        { id: "a1", type: "ACTION", kind: "SEND_MESSAGE", label: "Send Message", config: { message: "Welcome! How can we help?" }, position: { x: 360, y: 120 } },
        { id: "e1", type: "END", kind: "END", label: "End", config: {}, position: { x: 640, y: 120 } },
      ],
      edges: [
        { id: "e-t1-a1", source: "t1", target: "a1" },
        { id: "e-a1-e1", source: "a1", target: "e1" },
      ],
    },
  },
  {
    slug: "lead-capture",
    name: "Lead Capture",
    description: "Tag leads who message a keyword.",
    category: "Growth",
    tags: ["lead", "tag"],
    snapshot: {
      nodes: [
        { id: "t1", type: "TRIGGER", kind: "KEYWORD", label: "Keyword", config: { keyword: "demo" }, position: { x: 80, y: 100 } },
        { id: "c1", type: "CONDITION", kind: "CONTAINS_TEXT", label: "Contains Text", config: { value: "demo" }, position: { x: 320, y: 100 } },
        { id: "a1", type: "ACTION", kind: "ADD_TAG", label: "Add Tag", config: { tag: "New Lead" }, position: { x: 560, y: 40 } },
        { id: "a2", type: "ACTION", kind: "SEND_MESSAGE", label: "Send Message", config: { message: "Thanks! A specialist will reach out." }, position: { x: 560, y: 180 } },
        { id: "e1", type: "END", kind: "END", label: "End", config: {}, position: { x: 800, y: 100 } },
      ],
      edges: [
        { id: "e1", source: "t1", target: "c1" },
        { id: "e2", source: "c1", target: "a1", sourceHandle: "yes" },
        { id: "e3", source: "c1", target: "a2", sourceHandle: "no" },
        { id: "e4", source: "a1", target: "e1" },
        { id: "e5", source: "a2", target: "e1" },
      ],
    },
  },
  {
    slug: "faq",
    name: "FAQ",
    description: "Answer common questions with saved replies.",
    category: "Support",
    tags: ["faq"],
    snapshot: {
      nodes: [
        { id: "t1", type: "TRIGGER", kind: "WHATSAPP_MESSAGE", label: "WhatsApp Message", config: {}, position: { x: 80, y: 120 } },
        { id: "c1", type: "CONDITION", kind: "CONTAINS_TEXT", label: "Contains Text", config: { value: "hours" }, position: { x: 340, y: 120 } },
        { id: "a1", type: "ACTION", kind: "SEND_MESSAGE", label: "Send Message", config: { message: "We’re open 9–6 weekdays." }, position: { x: 600, y: 120 } },
        { id: "e1", type: "END", kind: "END", label: "End", config: {}, position: { x: 860, y: 120 } },
      ],
      edges: [
        { id: "e1", source: "t1", target: "c1" },
        { id: "e2", source: "c1", target: "a1", sourceHandle: "yes" },
        { id: "e3", source: "a1", target: "e1" },
      ],
    },
  },
  {
    slug: "discount-campaign",
    name: "Discount Campaign",
    description: "Send a promo when followers message.",
    category: "Campaigns",
    tags: ["discount", "promo"],
    snapshot: {
      nodes: [
        { id: "t1", type: "TRIGGER", kind: "NEW_FOLLOWER", label: "New Follower", config: {}, position: { x: 80, y: 120 } },
        { id: "d1", type: "DELAY", kind: "DELAY", label: "Delay", config: { seconds: 300 }, position: { x: 320, y: 120 } },
        { id: "a1", type: "ACTION", kind: "SEND_MESSAGE", label: "Send Message", config: { message: "Thanks for following! Use WELCOME10 for 10% off." }, position: { x: 560, y: 120 } },
        { id: "e1", type: "END", kind: "END", label: "End", config: {}, position: { x: 800, y: 120 } },
      ],
      edges: [
        { id: "e1", source: "t1", target: "d1" },
        { id: "e2", source: "d1", target: "a1" },
        { id: "e3", source: "a1", target: "e1" },
      ],
    },
  },
  {
    slug: "comment-to-dm",
    name: "Comment to DM",
    description: "Reply to comments with a DM offer.",
    category: "Engagement",
    tags: ["comment", "dm"],
    snapshot: {
      nodes: [
        { id: "t1", type: "TRIGGER", kind: "INSTAGRAM_COMMENT", label: "Instagram Comment", config: {}, position: { x: 80, y: 120 } },
        { id: "a1", type: "ACTION", kind: "SEND_MESSAGE", label: "Send Message", config: { message: "Thanks for commenting! Check your DMs." }, position: { x: 380, y: 120 } },
        { id: "e1", type: "END", kind: "END", label: "End", config: {}, position: { x: 680, y: 120 } },
      ],
      edges: [
        { id: "e1", source: "t1", target: "a1" },
        { id: "e2", source: "a1", target: "e1" },
      ],
    },
  },
  {
    slug: "customer-support",
    name: "Customer Support",
    description: "Assign support chats during business hours.",
    category: "Support",
    tags: ["support"],
    snapshot: {
      nodes: [
        { id: "t1", type: "TRIGGER", kind: "FACEBOOK_MESSAGE", label: "Facebook Message", config: {}, position: { x: 60, y: 120 } },
        { id: "c1", type: "CONDITION", kind: "BUSINESS_HOURS", label: "Business Hours", config: {}, position: { x: 320, y: 120 } },
        { id: "a1", type: "ACTION", kind: "ASSIGN_CONVERSATION", label: "Assign Conversation", config: { agent: "support" }, position: { x: 580, y: 40 } },
        { id: "a2", type: "ACTION", kind: "CREATE_NOTE", label: "Create Note", config: { note: "After-hours — queue for morning." }, position: { x: 580, y: 200 } },
        { id: "e1", type: "END", kind: "END", label: "End", config: {}, position: { x: 840, y: 120 } },
      ],
      edges: [
        { id: "e1", source: "t1", target: "c1" },
        { id: "e2", source: "c1", target: "a1", sourceHandle: "yes" },
        { id: "e3", source: "c1", target: "a2", sourceHandle: "no" },
        { id: "e4", source: "a1", target: "e1" },
        { id: "e5", source: "a2", target: "e1" },
      ],
    },
  },
  {
    slug: "product-launch",
    name: "Product Launch",
    description: "Notify and tag interested customers.",
    category: "Campaigns",
    tags: ["launch"],
    snapshot: {
      nodes: [
        { id: "t1", type: "TRIGGER", kind: "KEYWORD", label: "Keyword", config: { keyword: "launch" }, position: { x: 80, y: 120 } },
        { id: "a1", type: "ACTION", kind: "ADD_TAG", label: "Add Tag", config: { tag: "Launch Interest" }, position: { x: 340, y: 120 } },
        { id: "a2", type: "ACTION", kind: "NOTIFY_USER", label: "Notify User", config: { user: "marketing" }, position: { x: 600, y: 120 } },
        { id: "e1", type: "END", kind: "END", label: "End", config: {}, position: { x: 860, y: 120 } },
      ],
      edges: [
        { id: "e1", source: "t1", target: "a1" },
        { id: "e2", source: "a1", target: "a2" },
        { id: "e3", source: "a2", target: "e1" },
      ],
    },
  },
  {
    slug: "appointment-booking",
    name: "Appointment Booking",
    description: "Capture booking intent and assign.",
    category: "Sales",
    tags: ["booking"],
    snapshot: {
      nodes: [
        { id: "t1", type: "TRIGGER", kind: "MANUAL", label: "Manual Trigger", config: {}, position: { x: 80, y: 120 } },
        { id: "a1", type: "ACTION", kind: "SEND_MESSAGE", label: "Send Message", config: { message: "Share a preferred time and we’ll confirm." }, position: { x: 340, y: 120 } },
        { id: "a2", type: "ACTION", kind: "MOVE_PIPELINE", label: "Move Pipeline", config: { stage: "Booking" }, position: { x: 600, y: 120 } },
        { id: "e1", type: "END", kind: "END", label: "End", config: {}, position: { x: 860, y: 120 } },
      ],
      edges: [
        { id: "e1", source: "t1", target: "a1" },
        { id: "e2", source: "a1", target: "a2" },
        { id: "e3", source: "a2", target: "e1" },
      ],
    },
  },
];

export type ValidationIssue = {
  nodeId?: string;
  severity: "error" | "warning";
  message: string;
};

export function validateFlow(snapshot: FlowSnapshot): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const triggers = snapshot.nodes.filter((n) => n.type === "TRIGGER");
  const ends = snapshot.nodes.filter((n) => n.type === "END" || n.kind === "END_WORKFLOW");

  if (triggers.length === 0) {
    issues.push({ severity: "error", message: "Workflow needs at least one trigger." });
  }
  if (ends.length === 0) {
    issues.push({ severity: "warning", message: "Add an End node to complete the flow." });
  }

  const targets = new Set(snapshot.edges.map((e) => e.target));
  const sources = new Set(snapshot.edges.map((e) => e.source));

  for (const node of snapshot.nodes) {
    const def = findKind(node.kind);
    if (def?.disabled) {
      issues.push({
        nodeId: node.id,
        severity: "error",
        message: `${node.label}: this node type is disabled.`,
      });
    }
    if (node.type !== "TRIGGER" && !targets.has(node.id) && snapshot.nodes.length > 1) {
      issues.push({
        nodeId: node.id,
        severity: "warning",
        message: `${node.label}: missing incoming connection.`,
      });
    }
    if (node.type !== "END" && node.kind !== "END_WORKFLOW" && !sources.has(node.id) && snapshot.nodes.length > 1) {
      issues.push({
        nodeId: node.id,
        severity: "warning",
        message: `${node.label}: missing outgoing connection.`,
      });
    }
    if (def?.fields) {
      for (const field of def.fields) {
        const val = node.config?.[field.key];
        if (field.key && (val === undefined || val === null || val === "")) {
          // Only require obvious config fields for common actions
          if (["message", "keyword", "tag", "value"].includes(field.key)) {
            issues.push({
              nodeId: node.id,
              severity: "error",
              message: `${node.label}: missing “${field.label}”.`,
            });
          }
        }
      }
    }
  }

  return issues;
}
