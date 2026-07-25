export const queryKeys = {
  workspaces: (userId: string) => ["workspaces", userId] as const,
  workspace: (slug: string) => ["workspace", slug] as const,
  brands: (workspaceId: string) => ["brands", workspaceId] as const,
  brand: (workspaceId: string, brandSlug: string) =>
    ["brand", workspaceId, brandSlug] as const,
};
