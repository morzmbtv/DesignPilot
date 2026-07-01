import { PrismaClient } from "@prisma/client";
import { compileDesignModel } from "../lib/idm/design-compiler";
import { createIdmFromLegacy } from "../lib/idm/legacy-converter";

const prisma = new PrismaClient();

async function main() {
  const versions = await prisma.screenVersion.findMany({
    where: { internalDesignModel: null },
    include: {
      screen: {
        include: {
          project: {
            include: { rules: true, designTokens: true },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  let created = 0;
  for (const version of versions) {
    const idm = createIdmFromLegacy({
      projectName: version.screen.project.name,
      screenName: version.screen.name,
      platform: version.screen.project.platform,
      versionNumber: version.versionNumber,
      layoutJson: version.layoutJson,
      userRequest: version.userRequest,
      changeSummary: version.changeSummary || "Legacy ScreenVersion migrated to IDM",
      source: "legacy_migration",
      tokens: version.screen.project.designTokens.map(({ group, name, value }) => ({ group, name, value })),
    });
    const compiled = compileDesignModel(idm, version.screen.project.rules.map(({ category, name, value }) => ({ category, name, value })));
    await prisma.screenDesign.create({
      data: {
        projectId: version.screen.projectId,
        screenId: version.screenId,
        screenVersionId: version.id,
        modelJson: JSON.stringify(compiled.idm),
        normalizedJson: JSON.stringify(compiled.idm),
        validationJson: JSON.stringify(compiled.validation),
      },
    });
    created += 1;
  }

  console.log(`ScreenDesign backfill complete. Created: ${created}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
