'use client';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { departmentHexColor } from '@/lib/utils';

const INSTITUTIONAL_COLORS = ['#003DA5', '#00244D', '#53C3EE', '#795D3E', '#C8C9C7', '#E3DECB'];
const RADIAN = Math.PI / 180;

const tooltipStyle = {
  contentStyle: { backgroundColor: '#fff', border: '1px solid #c8c9c7', borderRadius: '2px', fontSize: 12, boxShadow: 'none' },
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
        <CartesianGrid stroke="#e5e7eb" vertical={false} />
        <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#4b5563' }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11, fill: '#4b5563' }} tickLine={false} axisLine={false} />
        <Tooltip {...tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {keys.map((k, i) => (
          <Area key={k.key} type="monotone" dataKey={k.key} name={k.name}
            stroke={k.color || INSTITUTIONAL_COLORS[i % INSTITUTIONAL_COLORS.length]}
            fill={k.color || INSTITUTIONAL_COLORS[i % INSTITUTIONAL_COLORS.length]}
            fillOpacity={0.06} strokeWidth={2} dot={false} activeDot={{ r: 3 }}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── Annual Publications Bar ───────────────────────────────────────────────
export function PublicationBarChart({
  data,
  keys,
}: {
  data: { year: number; [key: string]: number | string }[];
  keys: { key: string; name: string; color?: string }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }} barSize={14}>
        <CartesianGrid stroke="#e5e7eb" vertical={false} />
        <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#4b5563' }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11, fill: '#4b5563' }} tickLine={false} axisLine={false} />
        <Tooltip {...tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {keys.map((item, index) => (
          <Bar
            key={item.key}
            dataKey={item.key}
            name={item.name}
            fill={item.color || INSTITUTIONAL_COLORS[index % INSTITUTIONAL_COLORS.length]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── h-index Comparison ────────────────────────────────────────────────────
export function HIndexChart({ data }: { data: { name: string; hIndex: number; dept: string }[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 80, bottom: 5 }} barSize={14}>
        <CartesianGrid stroke="#e5e7eb" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11, fill: '#4b5563' }} tickLine={false} axisLine={false} />
        <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#4b5563' }} tickLine={false} axisLine={false} width={78} />
        <Tooltip {...tooltipStyle} />
        <Bar dataKey="hIndex" name="h-index">
          {data.map((d, i) => (
            <Cell key={i} fill={departmentHexColor(d.dept)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Department Comparison Donut ────────────────────────────────────────────
export function DeptPieChart({ data }: { data: { name: string; value: number; color?: string }[] }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  const renderLabel = ({
    cx,
    cy,
    midAngle,
    outerRadius,
    percent,
    name,
  }: {
    cx: number;
    cy: number;
    midAngle: number;
    outerRadius: number;
    percent?: number;
    name?: string;
  }) => {
    if (!percent || !name) return null;

    const labelRadius = outerRadius + 24;
    const x = cx + labelRadius * Math.cos(-midAngle * RADIAN);
    const y = cy + labelRadius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill={data.find(item => item.name === name)?.color || departmentHexColor(name)}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={12}
        fontWeight={600}
      >
        {name} {(percent * 100).toFixed(0)}%
      </text>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={54} outerRadius={74}
          paddingAngle={3} dataKey="value" nameKey="name"
          label={renderLabel}
          labelLine={false}
        >
          {data.map((item, i) => <Cell key={i} fill={item.color || departmentHexColor(item.name)} />)}
        </Pie>
        <Tooltip {...tooltipStyle} />
        {total === 0 && (
          <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fill="#6b7280" fontSize={12}>
            No data
          </text>
        )}
      </PieChart>
    </ResponsiveContainer>
  );
}

// ── Impact Factor Distribution ────────────────────────────────────────────
export function ImpactFactorChart({ data }: { data: { bucket: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }} barSize={32}>
        <CartesianGrid stroke="#e5e7eb" vertical={false} />
        <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: '#4b5563' }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11, fill: '#4b5563' }} tickLine={false} axisLine={false} />
        <Tooltip {...tooltipStyle} />
        <Bar dataKey="count" name="Articles" fill="#003DA5" />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Specialty Chart ───────────────────────────────────────────────────────
export function SpecialtyBarChart({ data }: { data: { specialty: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 130, bottom: 5 }} barSize={12}>
        <CartesianGrid stroke="#e5e7eb" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11, fill: '#4b5563' }} tickLine={false} axisLine={false} />
        <YAxis dataKey="specialty" type="category" tick={{ fontSize: 11, fill: '#4b5563' }} tickLine={false} axisLine={false} width={125} />
        <Tooltip {...tooltipStyle} />
        <Bar dataKey="count" name="Publications" fill="#4b5563" />
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
