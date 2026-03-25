import { prisma } from '@/lib/prisma';
import type { DepartmentSummary } from '@/types';

export function normalizeDepartmentCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, '-');
}

export async function getAllDepartments(includeInactive = true): Promise<DepartmentSummary[]> {
  const researchers = await prisma.researcher.groupBy({
    by: ['department'],
    _count: { _all: true },
  });

  let departments: Array<{
    id: string;
    code: string;
    name: string;
    shortName: string | null;
    color: string | null;
    activeStatus: boolean;
    displayOrder: number;
  }> = [];

  try {
    departments = await prisma.department.findMany({
      where: includeInactive ? {} : { activeStatus: true },
      orderBy: [
        { activeStatus: 'desc' },
        { displayOrder: 'asc' },
        { name: 'asc' },
      ],
    });
  } catch {
    departments = [];
  }

  const counts = new Map(researchers.map(item => [item.department, item._count._all]));
  const knownCodes = new Set(departments.map(department => department.code));

  const inferredDepartments = researchers
    .filter(item => item.department && !knownCodes.has(item.department))
    .map((item, index) => ({
      id: `inferred-${item.department}`,
      code: item.department,
      name: item.department,
      shortName: item.department,
      color: null,
      activeStatus: true,
      displayOrder: 10_000 + index,
    }));

  return [...departments, ...inferredDepartments]
    .filter(department => includeInactive || department.activeStatus)
    .map(department => ({
      id: department.id,
      code: department.code,
      name: department.name,
      shortName: department.shortName,
      color: department.color,
      activeStatus: department.activeStatus,
      displayOrder: department.displayOrder,
      researcherCount: counts.get(department.code) || 0,
    }))
    .sort((a, b) => {
      if (a.activeStatus !== b.activeStatus) {
        return a.activeStatus ? -1 : 1;
      }
      if (a.displayOrder !== b.displayOrder) {
        return a.displayOrder - b.displayOrder;
      }
      return a.name.localeCompare(b.name);
    });
}
