import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  if (await prisma.project.count()) return;

  const bankProject = await prisma.project.create({
    data: {
      name: "Мобильный банк",
      description: "Управление финансами, платежами и переводами",
      targetUsers: "Люди 20–45 лет, которые ежедневно управляют личными финансами.",
      appGoal: "Сделать сложные финансовые действия понятными.",
      platform: "iOS и Android",
      styleDirection: "Чистый, уверенный, минималистичный.",
      designRequirements: "Высокий контраст, один главный CTA на экран, понятные статусы.",
      architectureNotes: "Onboarding, главная, платежи, история, профиль.",
      constraints: "Не использовать мелкий текст и скрытые комиссии.",
      rules: {
        create: [
          { category: "Цвет", name: "Основной акцент", value: "Electric violet", source: "user" },
          { category: "Компоненты", name: "Главное действие", value: "Один primary CTA на экран", source: "brief" },
        ],
      },
      screens: {
        create: [
          {
            name: "Главная",
            purpose: "Баланс, быстрые действия и последние операции",
            status: "approved",
            versions: {
              create: [{
                versionNumber: 1,
                userRequest: "Сделать главный экран мобильного банка.",
                designSpec: "Баланс в верхней части, сетка быстрых действий, список последних операций.",
                imagePrompt: "Mobile banking home screen, clean editorial UI, electric violet accent.",
                changeSummary: "Первая утверждённая версия",
              }],
            },
          },
          { name: "Перевод", purpose: "Пошаговый перевод по номеру телефона" },
          { name: "История", purpose: "Список операций и фильтры" },
        ],
      },
    },
    include: {
      screens: { include: { versions: true } },
    },
  });

  const approvedHome = bankProject.screens.find((screen) => screen.status === "approved");
  const approvedHomeVersion = approvedHome?.versions[0];
  if (approvedHome && approvedHomeVersion) {
    await prisma.screen.update({
      where: { id: approvedHome.id },
      data: { approvedVersionId: approvedHomeVersion.id },
    });
    await prisma.screenSummary.create({
      data: {
        projectId: bankProject.id,
        screenId: approvedHome.id,
        screenVersionId: approvedHomeVersion.id,
        summary: "Главный экран банка с балансом, быстрыми действиями и последними операциями.",
        mainPurpose: approvedHome.purpose,
        primaryUserAction: "Выбрать финансовое действие",
        usedPatterns: JSON.stringify(["balance hero", "quick actions", "transaction list"]),
        usedRules: JSON.stringify(["Основной акцент", "Главное действие"]),
        visualNotes: "Чистая иерархия с electric violet акцентом.",
      },
    });
    await prisma.designDecision.create({
      data: {
        projectId: bankProject.id,
        screenId: approvedHome.id,
        screenVersionId: approvedHomeVersion.id,
        type: "layout_decision",
        target: "Главный экран / быстрые действия",
        newValue: "Сетка быстрых действий под балансом",
        reason: "Сократить путь до частых банковских операций.",
        source: "system",
        status: "approved",
      },
    });
  }

  await prisma.project.create({
    data: {
      name: "FitFlow",
      description: "Фитнес-трекер с планами тренировок и достижениями",
      targetUsers: "Новички и любители регулярных тренировок.",
      appGoal: "Помочь придерживаться персонального плана тренировок.",
      styleDirection: "Энергичный, воздушный, спортивный.",
      screens: { create: [{ name: "План на сегодня", purpose: "Текущая тренировка" }, { name: "Прогресс", purpose: "Динамика результатов" }] },
    },
  });

  await prisma.project.create({
    data: {
      name: "Travel Mate",
      description: "Маршруты, бронирования и рекомендации для поездок",
      targetUsers: "Самостоятельные путешественники.",
      appGoal: "Собрать всю поездку в одном понятном маршруте.",
      styleDirection: "Тёплый редакционный travel-дизайн.",
      screens: { create: [{ name: "Маршрут поездки" }, { name: "Место" }, { name: "Бронирования" }] },
    },
  });
}

main().finally(() => prisma.$disconnect());
