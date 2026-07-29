const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

async function main() {
  const brands = await p.brand.findMany({
    select: {
      id: true,
      slug: true,
      name: true,
      workspace: { select: { slug: true } },
      profile: {
        select: {
          id: true,
          onboardingStep: true,
          onboardingCompletedAt: true,
        },
      },
    },
  });
  console.log(JSON.stringify(brands, null, 2));

  for (const b of brands) {
    if (!b.profile) continue;
    await p.brandProfile.update({
      where: { id: b.profile.id },
      data: {
        onboardingStep: 99,
        onboardingCompletedAt: new Date(),
        businessName: b.name || "Light QA Brand",
      },
    });
  }
  console.log("onboarding marked complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
