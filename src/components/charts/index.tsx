'use client';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, Sector,
} from 'recharts';
import { cn } from '@/lib/utils';

const BRAND_COLORS = ['#1a6fb5', '#14b8a6', '#16a34a', '#d97706', '#dc2626', '#8b5cf6', '#ec4899', '#0891b2'];
const DEPT_COLORS = { AHEAD: '#1a6fb5', HCOR: '#14b8a6' };

const tooltipStyle = {
  contentStyle: { backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: 12, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' },
  labelStyle: { fontWeight: 600, color: '#111827', marginBottom: 4 },
};

// ── Citation Trend Line ───────────────────────────────────────────────────
export function CitationTrendChart({ data, keys, cumulative = false }: {
  data: Record<string, any>[];
  keys: { key: string; name: string; color?: string }[];
  cumulative?: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="year" tick={{ fontSize: 11 }} tickLine={false} />
        <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <Tooltip {...tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {keys.map((k, i) => (
          <Area key={k.key} type="monotone" dataKey={k.key} name={k.name}
            stroke={k.color || BRAND_COLORS[i % BRAND_COLORS.length]}
            fill={k.color || BRAND_COLORS[i % BRAND_COLORS.length]}
            fillOpacity={0.08} strokeWidth={2} dot={false} activeDot={{ r: 4 }}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── Annual Publications Bar ───────────────────────────────────────────────
export function PublicationBarChart({ data }: { data: { year: number; AHEAD: number; HCOR: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }} barSize={14}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis dataKey="year" tick={{ fontSize: 11 }} tickLine={false} />
        <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <Tooltip {...tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="AHEAD" name="AHEAD" fill={DEPT_COLORS.AHEAD} radius={[3, 3, 0, 0]} />
        <Bar dataKey="HCOR"  name="HCOR"  fill={DEPT_COLORS.HCOR}  radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── h-index Comparison ────────────────────────────────────────────────────
export function HIndexChart({ data }: { data: { name: string; hIndex: number; dept: string }[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 80, bottom: 5 }} barSize={14}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} />
        <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={78} />
        <Tooltip {...tooltipStyle} />
        <Bar dataKey="hIndex" name="h-index" radius={[0, 3, 3, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.dept === 'AHEAD' ? DEPT_COLORS.AHEAD : DEPT_COLORS.HCOR} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Department Comparison Donut ────────────────────────────────────────────
export function DeptPieChart({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={85}
          paddingAngle={3} dataKey="value" nameKey="name"
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          labelLine={false}
        >
          {data.map((_, i) => <Cell key={i} fill={i === 0 ? DEPT_COLORS.AHEAD : DEPT_COLORS.HCOR} />)}
        </Pie>
        <Tooltip {...tooltipStyle} />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ── Impact Factor Distribution ────────────────────────────────────────────
export function ImpactFactorChart({ data }: { data: { bucket: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }} barSize={32}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis dataKey="bucket" tick={{ fontSize: 11 }} tickLine={false} />
        <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <Tooltip {...tooltipStyle} />
        <Bar dataKey="count" name="Articles" fill="#1a6fb5" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Specialty Chart ───────────────────────────────────────────────────────
export function SpecialtyBarChart({ data }: { data: { specialty: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 130, bottom: 5 }} barSize={12}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} />
        <YAxis dataKey="specialty" type="category" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={125} />
        <Tooltip {...tooltipStyle} />
        <Bar dataKey="count" name="Publications" fill="#14b8a6" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Mini sparkline ────────────────────────────────────────────────────────
export function Sparkline({ data, color = '#1a6fb5' }: { data: number[]; color?: string }) {
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width={80} height={28}>
      <LineChart data={pts}>
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
