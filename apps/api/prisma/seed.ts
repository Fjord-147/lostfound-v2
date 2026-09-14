// 初始账号 seed：从环境变量读，不写死在代码里
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const username = process.env.SEED_USERNAME || "liumin";
  const password = process.env.SEED_PASSWORD || "liumin123";
  const name = process.env.SEED_NAME || "刘敏";

  const exists = await prisma.user.findUnique({ where: { username } });
  if (exists) {
    console.log(`账号 ${username} 已存在，跳过 seed`);
    return;
  }
  await prisma.user.create({
    data: {
      username,
      passwordHash: await bcrypt.hash(password, 10),
      name,
      role: "admin",
    },
  });
  console.log(`已创建初始账号：${username}（${name}）`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
