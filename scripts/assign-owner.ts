import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.INITIAL_ADMIN_EMAIL || "admin@designpilot.local").trim().toLowerCase();
  const owner = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name: "Владелец DesignPilot",
      settings: { create: {} },
    },
    update: {},
    select: { id: true, email: true },
  });

  await prisma.userSettings.upsert({
    where: { userId: owner.id },
    create: { userId: owner.id },
    update: {},
  });

  const result = await prisma.project.updateMany({
    where: { userId: null },
    data: { userId: owner.id },
  });

  console.log(`Владелец: ${owner.email}`);
  console.log(`Привязано проектов: ${result.count}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
