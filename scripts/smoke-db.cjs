const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const brand = await prisma.brand.findFirst();
  console.log("brand:", brand?.name ?? "none");
  if (!brand) return;

  const doc = await prisma.knowledgeDocument.create({
    data: { brandId: brand.id, title: "Smoke Doc", body: "Hello" },
  });
  console.log("doc ok:", doc.id);
  await prisma.knowledgeDocument.delete({ where: { id: doc.id } });

  const content = await prisma.contentItem.create({
    data: { brandId: brand.id, title: "Smoke Content" },
  });
  console.log("content ok:", content.id);
  await prisma.contentItem.delete({ where: { id: content.id } });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
