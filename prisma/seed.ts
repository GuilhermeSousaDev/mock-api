import { PrismaClient, Plan } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const TECH_STACKS = [
  { name: 'React', slug: 'react', category: 'Frontend' },
  { name: 'Next.js', slug: 'nextjs', category: 'Frontend' },
  { name: 'TypeScript', slug: 'typescript', category: 'Language' },
  { name: 'Node.js', slug: 'nodejs', category: 'Backend' },
  { name: 'NestJS', slug: 'nestjs', category: 'Backend' },
  { name: 'PostgreSQL', slug: 'postgresql', category: 'Database' },
  { name: 'MongoDB', slug: 'mongodb', category: 'Database' },
  { name: 'Redis', slug: 'redis', category: 'Database' },
  { name: 'Docker', slug: 'docker', category: 'DevOps' },
  { name: 'Kubernetes', slug: 'kubernetes', category: 'DevOps' },
  { name: 'AWS', slug: 'aws', category: 'Cloud' },
  { name: 'System Design', slug: 'system-design', category: 'Architecture' },
  { name: 'Data Structures & Algorithms', slug: 'dsa', category: 'Computer Science' },
  { name: 'Python', slug: 'python', category: 'Language' },
  { name: 'Go', slug: 'go', category: 'Language' },
  { name: 'GraphQL', slug: 'graphql', category: 'API' },
  { name: 'REST APIs', slug: 'rest-apis', category: 'API' },
];

async function main() {
  console.log('Seeding database...');

  // Upsert tech stacks
  for (const stack of TECH_STACKS) {
    await prisma.techStack.upsert({
      where: { slug: stack.slug },
      update: {},
      create: stack,
    });
  }
  console.log(`Seeded ${TECH_STACKS.length} tech stacks`);

  // Demo user
  const passwordHash = await bcrypt.hash('demo1234', 12);
  const demo = await prisma.user.upsert({
    where: { email: 'demo@mock.dev' },
    update: {},
    create: {
      email: 'demo@mock.dev',
      name: 'Demo User',
      passwordHash,
      subscription: { create: { plan: Plan.PRO } },
    },
  });
  console.log(`Demo user: ${demo.email} / demo1234`);

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
