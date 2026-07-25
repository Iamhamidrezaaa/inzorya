import type { ChannelPlatform, PrismaClient } from "@prisma/client";
import { ensureSocialChannelCatalog, SOCIAL_CHANNEL_CATALOG } from "@/lib/business";

const MOCK_TAGS = [
  { name: "VIP", color: "#f59e0b" },
  { name: "New Lead", color: "#38bdf8" },
  { name: "Hot Lead", color: "#f43f5e" },
  { name: "Customer", color: "#34d399" },
  { name: "Influencer", color: "#a78bfa" },
  { name: "Returning", color: "#14b8a6" },
  { name: "Spam", color: "#94a3b8" },
];

const MOCK_REPLIES = [
  {
    title: "Welcome",
    category: "Greeting",
    shortcut: "/welcome",
    body: "Hi! Thanks for reaching out to us. How can we help today?",
  },
  {
    title: "Pricing",
    category: "Sales",
    shortcut: "/pricing",
    body: "Happy to share pricing. Our plans start from the Starter tier — want me to send a quick comparison?",
  },
  {
    title: "Hours",
    category: "Support",
    shortcut: "/hours",
    body: "We’re typically online 9am–6pm on weekdays. Leave a note and we’ll get back soon.",
  },
  {
    title: "Closing",
    category: "Closing",
    shortcut: "/thanks",
    body: "Glad that helped! Feel free to message anytime if you need anything else.",
  },
];

type SeedContact = {
  name: string;
  instagramUsername?: string;
  email?: string;
  phone?: string;
  country: string;
  language: string;
  leadStatus: string;
  lifetimeValue: string;
  tags: string[];
  platform: ChannelPlatform;
  unread: number;
  starred?: boolean;
  status: "OPEN" | "WAITING" | "RESOLVED" | "CLOSED" | "ARCHIVED";
  messages: { direction: "INBOUND" | "OUTBOUND"; body: string; hoursAgo: number }[];
};

const MOCK_CONTACTS: SeedContact[] = [
  {
    name: "Sara Mohammadi",
    instagramUsername: "sara.m",
    email: "sara@example.com",
    country: "Iran",
    language: "Persian",
    leadStatus: "Hot Lead",
    lifetimeValue: "$1,240",
    tags: ["Hot Lead", "VIP"],
    platform: "INSTAGRAM",
    unread: 2,
    starred: true,
    status: "OPEN",
    messages: [
      { direction: "INBOUND", body: "Hi! Do you ship to Tehran?", hoursAgo: 26 },
      { direction: "OUTBOUND", body: "Yes we do — usually 2–3 days.", hoursAgo: 25 },
      { direction: "INBOUND", body: "Perfect. Can I get the price list?", hoursAgo: 2 },
      { direction: "INBOUND", body: "Also interested in the spring collection 👀", hoursAgo: 1 },
    ],
  },
  {
    name: "Alex Chen",
    email: "alex@studio.co",
    phone: "+1 555 0102",
    country: "USA",
    language: "English",
    leadStatus: "Customer",
    lifetimeValue: "$4,800",
    tags: ["Customer", "Returning"],
    platform: "WHATSAPP",
    unread: 0,
    status: "WAITING",
    messages: [
      { direction: "INBOUND", body: "Order #4821 still processing?", hoursAgo: 10 },
      { direction: "OUTBOUND", body: "Checking with ops — one moment.", hoursAgo: 9 },
      { direction: "INBOUND", body: "Thanks, waiting here.", hoursAgo: 8 },
    ],
  },
  {
    name: "Mina Far",
    instagramUsername: "mina.far",
    country: "UAE",
    language: "English",
    leadStatus: "New Lead",
    lifetimeValue: "$0",
    tags: ["New Lead"],
    platform: "FACEBOOK",
    unread: 1,
    status: "OPEN",
    messages: [
      { direction: "INBOUND", body: "Saw your ad. Is this available in Dubai?", hoursAgo: 5 },
    ],
  },
  {
    name: "Omar Khalid",
    email: "omar@corp.io",
    country: "Saudi Arabia",
    language: "Arabic",
    leadStatus: "Influencer",
    lifetimeValue: "$900",
    tags: ["Influencer"],
    platform: "TELEGRAM",
    unread: 0,
    status: "RESOLVED",
    messages: [
      { direction: "INBOUND", body: "Collab rates for next month?", hoursAgo: 72 },
      { direction: "OUTBOUND", body: "Sending a deck shortly.", hoursAgo: 70 },
      { direction: "INBOUND", body: "Received, looks good!", hoursAgo: 48 },
    ],
  },
  {
    name: "Jordan Lee",
    instagramUsername: "jlee",
    email: "jordan@mail.com",
    country: "UK",
    language: "English",
    leadStatus: "Customer",
    lifetimeValue: "$320",
    tags: ["Customer"],
    platform: "LINKEDIN",
    unread: 0,
    status: "CLOSED",
    messages: [
      { direction: "INBOUND", body: "Can we book a demo for Friday?", hoursAgo: 96 },
      { direction: "OUTBOUND", body: "Friday 11am works. Calendar invite sent.", hoursAgo: 95 },
    ],
  },
  {
    name: "Spam Bot",
    email: "promo@spam.xyz",
    country: "Unknown",
    language: "English",
    leadStatus: "Spam",
    lifetimeValue: "$0",
    tags: ["Spam"],
    platform: "X",
    unread: 0,
    status: "ARCHIVED",
    messages: [
      { direction: "INBOUND", body: "Buy followers cheap!!!", hoursAgo: 120 },
    ],
  },
  {
    name: "Nora Aziz",
    phone: "+98 912 000 1122",
    country: "Iran",
    language: "Persian",
    leadStatus: "New Lead",
    lifetimeValue: "$60",
    tags: ["New Lead", "Returning"],
    platform: "TIKTOK",
    unread: 3,
    starred: true,
    status: "OPEN",
    messages: [
      { direction: "INBOUND", body: "Loved the last reel 🔥", hoursAgo: 4 },
      { direction: "INBOUND", body: "Do you have a size guide?", hoursAgo: 3 },
      { direction: "INBOUND", body: "Also need gift wrapping", hoursAgo: 2 },
    ],
  },
];

export async function ensureInboxMockData(
  prisma: PrismaClient,
  input: { brandId: string; workspaceId: string; userId: string },
) {
  const existing = await prisma.conversation.count({
    where: { brandId: input.brandId },
  });
  if (existing > 0) return { seeded: false };

  await ensureSocialChannelCatalog();

  for (const tag of MOCK_TAGS) {
    await prisma.inboxTag.upsert({
      where: {
        brandId_name: { brandId: input.brandId, name: tag.name },
      },
      create: { brandId: input.brandId, name: tag.name, color: tag.color },
      update: { color: tag.color },
    });
  }

  for (const reply of MOCK_REPLIES) {
    await prisma.savedReply.upsert({
      where: {
        brandId_shortcut: {
          brandId: input.brandId,
          shortcut: reply.shortcut,
        },
      },
      create: {
        brandId: input.brandId,
        title: reply.title,
        body: reply.body,
        category: reply.category,
        shortcut: reply.shortcut,
      },
      update: {
        title: reply.title,
        body: reply.body,
        category: reply.category,
      },
    });
  }

  for (const mock of MOCK_CONTACTS) {
    const catalog = SOCIAL_CHANNEL_CATALOG.find((c) => c.platform === mock.platform)!;
    const social = await prisma.socialChannel.findUnique({
      where: { platform: mock.platform },
    });
    if (!social) continue;

    const connection = await prisma.channelConnection.upsert({
      where: {
        brandId_socialChannelId: {
          brandId: input.brandId,
          socialChannelId: social.id,
        },
      },
      create: {
        brandId: input.brandId,
        socialChannelId: social.id,
        status: "CONNECTED",
        accountName: catalog.mockAccountName,
        accountHandle: catalog.mockHandle,
        lastSyncAt: new Date(),
        providerMeta: { mock: true },
        permissions: {
          create: catalog.permissions.map((p) => ({
            scope: p.scope,
            label: p.label,
            granted: true,
          })),
        },
      },
      update: {
        status: "CONNECTED",
        lastSyncAt: new Date(),
      },
    });

    const contact = await prisma.contact.create({
      data: {
        brandId: input.brandId,
        name: mock.name,
        instagramUsername: mock.instagramUsername,
        email: mock.email,
        phone: mock.phone,
        country: mock.country,
        language: mock.language,
        leadStatus: mock.leadStatus,
        lifetimeValue: mock.lifetimeValue,
        tags: mock.tags,
        joinedAt: new Date(Date.now() - 40 * 86400000),
        notes: `Mock profile for ${mock.name}.`,
      },
    });

    const conversation = await prisma.conversation.create({
      data: {
        brandId: input.brandId,
        contactId: contact.id,
        channelId: connection.id,
        status: mock.status,
        isUnread: mock.unread > 0,
        unreadCount: mock.unread,
        isStarred: Boolean(mock.starred),
        assigneeId: mock.status === "WAITING" ? input.userId : null,
        subject: `Chat with ${mock.name}`,
        lastMessageAt: new Date(
          Date.now() - mock.messages[mock.messages.length - 1]!.hoursAgo * 3600000,
        ),
      },
    });

    await prisma.conversationParticipant.create({
      data: {
        conversationId: conversation.id,
        contactId: contact.id,
        role: "customer",
      },
    });

    await prisma.conversationEvent.create({
      data: {
        conversationId: conversation.id,
        type: "STARTED",
        title: "Conversation started",
        userId: input.userId,
        createdAt: new Date(Date.now() - 100 * 3600000),
      },
    });

    await prisma.conversationEvent.create({
      data: {
        conversationId: conversation.id,
        type: "CHANNEL_CONNECTED",
        title: `${catalog.name} connected`,
        createdAt: new Date(Date.now() - 99 * 3600000),
      },
    });

    for (const tagName of mock.tags) {
      const tag = await prisma.inboxTag.findUnique({
        where: { brandId_name: { brandId: input.brandId, name: tagName } },
      });
      if (tag) {
        await prisma.conversationTag.create({
          data: { conversationId: conversation.id, tagId: tag.id },
        });
      }
    }

    for (const msg of mock.messages) {
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          body: msg.body,
          direction: msg.direction,
          kind: "TEXT",
          deliveryStatus: msg.direction === "OUTBOUND" ? "READ" : "DELIVERED",
          authorId: msg.direction === "OUTBOUND" ? input.userId : null,
          createdAt: new Date(Date.now() - msg.hoursAgo * 3600000),
        },
      });
    }

    if (mock.status === "WAITING") {
      await prisma.assignment.create({
        data: {
          conversationId: conversation.id,
          userId: input.userId,
          assignedById: input.userId,
        },
      });
      await prisma.conversationEvent.create({
        data: {
          conversationId: conversation.id,
          type: "ASSIGNED",
          title: "Assigned to you",
          userId: input.userId,
        },
      });
    }

    await prisma.internalNote.create({
      data: {
        brandId: input.brandId,
        conversationId: conversation.id,
        contactId: contact.id,
        userId: input.userId,
        body: `Internal note: follow up with ${mock.name} about next steps.`,
      },
    });
  }

  // Add one system-style media message example
  const sample = await prisma.conversation.findFirst({
    where: { brandId: input.brandId, isStarred: true },
  });
  if (sample) {
    const mediaMsg = await prisma.message.create({
      data: {
        conversationId: sample.id,
        body: "Shared a lookbook image",
        direction: "INBOUND",
        kind: "IMAGE",
        deliveryStatus: "DELIVERED",
        createdAt: new Date(Date.now() - 30 * 60000),
      },
    });
    await prisma.messageAttachment.create({
      data: {
        messageId: mediaMsg.id,
        url: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400",
        filename: "product.jpg",
        mimeType: "image/jpeg",
        kind: "image",
      },
    });
  }

  return { seeded: true };
}
