import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireBrandAccess, requireUser } from "@/server/access";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const workspaceSlug = searchParams.get("workspaceSlug") || "";
    const brandSlug = searchParams.get("brandSlug") || "";
    const q = (searchParams.get("q") || "").trim();

    if (!workspaceSlug || !brandSlug) {
      return NextResponse.json({ error: "Missing scope." }, { status: 400 });
    }

    const access = await requireBrandAccess(workspaceSlug, brandSlug, user.id!);
    if (!access) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const base = `/w/${workspaceSlug}`;
    const b = `${base}/b/${brandSlug}`;

    const pages = [
      { id: "home", title: "Home", href: `${base}/home`, group: "Pages" },
      { id: "strategy", title: "Strategy", href: `${b}/strategy`, group: "Pages" },
      { id: "strategist", title: "AI Strategist", href: `${b}/strategist`, group: "Pages" },
      { id: "inbox", title: "Inbox", href: `${b}/inbox`, group: "Pages" },
      { id: "contacts", title: "Contacts", href: `${b}/contacts`, group: "Pages" },
      { id: "channels", title: "Channels", href: `${b}/channels`, group: "Pages" },
      { id: "automations", title: "Automations", href: `${b}/automations`, group: "Pages" },
      { id: "analytics", title: "Analytics", href: `${b}/analytics`, group: "Pages" },
      { id: "business", title: "Business Profile", href: `${b}/business`, group: "Pages" },
      { id: "knowledge", title: "Knowledge", href: `${b}/knowledge`, group: "Pages" },
      { id: "studio", title: "Content Studio", href: `${b}/studio`, group: "Pages" },
      { id: "content", title: "Content", href: `${b}/studio`, group: "Pages" },
      { id: "campaigns", title: "Campaigns", href: `${b}/campaigns`, group: "Pages" },
      { id: "media", title: "Media", href: `${b}/media`, group: "Pages" },
      { id: "activity", title: "Activity", href: `${base}/activity`, group: "Pages" },
      { id: "settings", title: "Settings", href: `${base}/settings`, group: "Settings" },
    ];

    const query = q.toLowerCase();
    const filteredPages = query
      ? pages.filter(
          (p) =>
            p.title.toLowerCase().includes(query) ||
            p.id.includes(query),
        )
      : pages;

    if (!q) {
      return NextResponse.json({
        pages: filteredPages,
        contacts: [],
        knowledge: [],
        content: [],
        channels: [],
      });
    }

    const [contacts, knowledge, content, channels] = await Promise.all([
      prisma.contact.findMany({
        where: {
          brandId: access.brand.id,
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { instagramUsername: { contains: q, mode: "insensitive" } },
          ],
        },
        take: 8,
        orderBy: { updatedAt: "desc" },
      }),
      prisma.knowledgeDocument.findMany({
        where: {
          brandId: access.brand.id,
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { body: { contains: q, mode: "insensitive" } },
          ],
        },
        take: 8,
        orderBy: { updatedAt: "desc" },
      }),
      prisma.contentItem.findMany({
        where: {
          brandId: access.brand.id,
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { body: { contains: q, mode: "insensitive" } },
          ],
        },
        take: 8,
        orderBy: { updatedAt: "desc" },
      }),
      prisma.channelConnection.findMany({
        where: {
          brandId: access.brand.id,
          OR: [
            { accountName: { contains: q, mode: "insensitive" } },
            { accountHandle: { contains: q, mode: "insensitive" } },
            { socialChannel: { name: { contains: q, mode: "insensitive" } } },
          ],
        },
        include: { socialChannel: true },
        take: 8,
      }),
    ]);

    return NextResponse.json({
      pages: filteredPages,
      contacts: contacts.map((c) => ({
        id: c.id,
        title: c.name || c.instagramUsername || c.email || "Contact",
        href: `${b}/contacts`,
        subtitle: c.instagramUsername || c.email || undefined,
      })),
      knowledge: knowledge.map((d) => ({
        id: d.id,
        title: d.title,
        href: `${b}/knowledge/${d.id}`,
      })),
      content: content.map((c) => ({
        id: c.id,
        title: c.title,
        href: `${b}/studio`,
        subtitle: c.status,
      })),
      channels: channels.map((c) => ({
        id: c.id,
        title: c.socialChannel.name,
        href: `${b}/channels`,
        subtitle: c.accountHandle || c.status,
      })),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Search failed." }, { status: 500 });
  }
}
