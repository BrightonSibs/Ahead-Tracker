const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const NOTICE_PATTERNS = [
  /^(erratum|errata)\b[:\s-]*/i,
  /^(corrigendum|corrigenda)\b[:\s-]*/i,
  /^correction\b[:\s-]*/i,
  /^(retraction|retracted article|retracted publication)\b[:\s-]*/i,
  /^expression of concern\b[:\s-]*/i,
  /^addendum\b[:\s-]*/i,
];

function isNonResearchNotice(title) {
  const normalized = String(title || '')
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim();

  return NOTICE_PATTERNS.some(pattern => pattern.test(normalized));
}

async function main() {
  const apply = process.argv.includes('--apply');

  const publications = await prisma.publication.findMany({
    select: {
      id: true,
      title: true,
      verifiedStatus: true,
      sourcePrimary: true,
    },
    orderBy: { title: 'asc' },
  });

  const flagged = publications.filter(publication => isNonResearchNotice(publication.title));

  if (!apply) {
    console.log(JSON.stringify({
      count: flagged.length,
      publications: flagged.slice(0, 100),
    }, null, 2));
    return;
  }

  let updated = 0;
  for (const publication of flagged) {
    if (publication.verifiedStatus === 'EXCLUDED') continue;

    await prisma.publication.update({
      where: { id: publication.id },
      data: { verifiedStatus: 'EXCLUDED' },
    });
    updated += 1;
  }

  console.log(JSON.stringify({
    flagged: flagged.length,
    updated,
  }, null, 2));
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
