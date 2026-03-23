'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { PageLayout, PageContent, TopBar } from '@/components/layout';
import { Card, CardHeader, CardTitle, Button, Spinner, Alert } from '@/components/ui';
import { departmentColor } from '@/lib/utils';

interface Node { id: string; name: string; department: string; publicationCount: number; x: number; y: number; vx: number; vy: number; r: number; }
interface Edge { source: string; target: string; weight: number; }

export default function CollaborationsPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const nodesRef = useRef<Node[]>([]);
  const edgesRef = useRef<Edge[]>([]);
  const draggingRef = useRef<Node | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<any>(null);

  const [deptFilter, setDeptFilter] = useState('');
  const [minCoauth, setMinCoauth] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [topPairs, setTopPairs] = useState<any[]>([]);
  const [topCollaborators, setTopCollaborators] = useState<any[]>([]);
  const [allResearchers, setAllResearchers] = useState<any[]>([]);
  const [edgeMap, setEdgeMap] = useState<Record<string, number>>({});

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  const buildNetwork = useCallback((researchers: any[], publications: any[]) => {
    const em: Record<string, number> = {};
    publications.forEach((pub: any) => {
      const rIds = pub.matchedResearchers.map((m: any) => m.id);
      for (let i = 0; i < rIds.length; i++) {
        for (let j = i + 1; j < rIds.length; j++) {
          const key = [rIds[i], rIds[j]].sort().join('|');
          em[key] = (em[key] || 0) + 1;
        }
      }
    });
    setEdgeMap(em);

    const W = canvasRef.current?.offsetWidth || 800;
    const H = canvasRef.current?.offsetHeight || 480;

    const filteredResearchers = deptFilter ? researchers.filter(r => r.department === deptFilter) : researchers;
    const filteredEdges = Object.entries(em)
      .filter(([, v]) => v >= minCoauth)
      .map(([k, v]) => { const [s, t] = k.split('|'); return { source: s, target: t, weight: v }; })
      .filter(e => filteredResearchers.some(r => r.id === e.source) && filteredResearchers.some(r => r.id === e.target));

    nodesRef.current = filteredResearchers.map(r => ({
      id: r.id, name: r.canonicalName, department: r.department,
      publicationCount: r.publicationCount,
      x: W / 2 + (Math.random() - 0.5) * 400,
      y: H / 2 + (Math.random() - 0.5) * 300,
      vx: 0, vy: 0,
      r: 10 + r.publicationCount * 1.8,
    }));
    edgesRef.current = filteredEdges;

    // Top pairs
    const pairs = Object.entries(em)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([k, count]) => {
        const [aId, bId] = k.split('|');
        const rA = researchers.find(r => r.id === aId);
        const rB = researchers.find(r => r.id === bId);
        return { rA, rB, count };
      })
      .filter(p => p.rA && p.rB);
    setTopPairs(pairs);

    // Top collaborators by degree
    const degree: Record<string, number> = {};
    filteredEdges.forEach(e => { degree[e.source] = (degree[e.source] || 0) + 1; degree[e.target] = (degree[e.target] || 0) + 1; });
    const tc = filteredResearchers
      .map(r => ({ ...r, degree: degree[r.id] || 0 }))
      .sort((a, b) => b.degree - a.degree)
      .slice(0, 6);
    setTopCollaborators(tc);

    startAnimation();
  }, [deptFilter, minCoauth]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (deptFilter) params.set('department', deptFilter);
    fetch(`/api/researchers?${params}`)
      .then(r => r.json())
      .then(async (researchers) => {
        setAllResearchers(researchers);
        // Build collaboration data from publications
        const pubResp = await fetch('/api/publications?pageSize=200');
        const pubData = await pubResp.json();
        buildNetwork(researchers, pubData.data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [deptFilter, minCoauth, buildNetwork]);

  function startAnimation() {
    cancelAnimationFrame(animRef.current);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const context = ctx;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth, H = canvas.offsetHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    context.scale(dpr, dpr);

    const DEPT_COLORS: Record<string, string> = { AHEAD: '#1a6fb5', HCOR: '#14b8a6' };

    function tick() {
      animRef.current = requestAnimationFrame(tick);
      const nodes = nodesRef.current;
      const edges = edgesRef.current;

      // Forces
      nodes.forEach(n => { n.vx *= 0.85; n.vy *= 0.85; n.vx += (W / 2 - n.x) * 0.001; n.vy += (H / 2 - n.y) * 0.001; });

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = Math.min(900 / (dist * dist), 8);
          const fx = (dx / dist) * force, fy = (dy / dist) * force;
          a.vx -= fx; a.vy -= fy; b.vx += fx; b.vy += fy;
        }
      }

      edges.forEach(e => {
        const a = nodes.find(n => n.id === e.source), b = nodes.find(n => n.id === e.target);
        if (!a || !b) return;
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const target = 100 + e.weight * 10;
        const force = (dist - target) * 0.025;
        const fx = (dx / dist) * force, fy = (dy / dist) * force;
        a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
      });

      nodes.forEach(n => {
        if (n === draggingRef.current) return;
        n.x += n.vx; n.y += n.vy;
        n.x = Math.max(n.r, Math.min(W - n.r, n.x));
        n.y = Math.max(n.r, Math.min(H - n.r, n.y));
      });

      // Draw
      context.clearRect(0, 0, W, H);

      // Edges
      edges.forEach(e => {
        const a = nodes.find(n => n.id === e.source), b = nodes.find(n => n.id === e.target);
        if (!a || !b) return;
        context.beginPath(); context.moveTo(a.x, a.y); context.lineTo(b.x, b.y);
        context.strokeStyle = `rgba(100,130,180,${Math.min(0.5, e.weight * 0.12)})`;
        context.lineWidth = Math.min(e.weight * 1.2, 5);
        context.stroke();
        // Weight label on thick edges
        if (e.weight >= 2) {
          const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
          context.fillStyle = 'rgba(100,120,160,0.8)';
          context.font = '9px DM Sans, sans-serif';
          context.textAlign = 'center';
          context.fillText(String(e.weight), mx, my);
        }
      });

      // Nodes
      nodes.forEach(n => {
        const color = DEPT_COLORS[n.department] || '#6b7280';
        // Shadow for selected
        if (selectedRef.current?.id === n.id) {
          context.shadowBlur = 16; context.shadowColor = color;
        }
        context.beginPath(); context.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        context.fillStyle = color + '22'; context.fill();
        context.strokeStyle = color; context.lineWidth = 2; context.stroke();
        context.shadowBlur = 0;

        // Initials
        context.fillStyle = color;
        context.font = `bold ${Math.max(9, n.r * 0.45)}px DM Sans, sans-serif`;
        context.textAlign = 'center'; context.textBaseline = 'middle';
        context.fillText(n.name.split(' ').map((p: string) => p[0]).slice(0, 2).join(''), n.x, n.y);

        // Name label
        if (n.r > 14) {
          context.fillStyle = '#374151';
          context.font = '10px DM Sans, sans-serif';
          context.fillText(n.name.split(' ').slice(-1)[0], n.x, n.y + n.r + 11);
        }
      });
    }
    tick();
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      let found: Node | null = null;
      nodesRef.current.forEach(n => {
        if (Math.sqrt((n.x - mx) ** 2 + (n.y - my) ** 2) < n.r + 4) found = n;
      });
      if (tooltipRef.current) {
        if (found) {
          tooltipRef.current.style.display = 'block';
          tooltipRef.current.style.left = (e.clientX + 12) + 'px';
          tooltipRef.current.style.top = (e.clientY - 36) + 'px';
          tooltipRef.current.innerHTML = `<strong>${(found as Node).name}</strong><br/>${(found as Node).department} · ${(found as Node).publicationCount} pubs`;
          canvas.style.cursor = 'pointer';
        } else {
          tooltipRef.current.style.display = 'none';
          canvas.style.cursor = 'default';
        }
      }
      if (draggingRef.current) { draggingRef.current.x = mx; draggingRef.current.y = my; }
    };
    const onMouseDown = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      nodesRef.current.forEach(n => { if (Math.sqrt((n.x - mx) ** 2 + (n.y - my) ** 2) < n.r + 4) draggingRef.current = n; });
    };
    const onMouseUp = () => { draggingRef.current = null; };
    const onClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      nodesRef.current.forEach(n => {
        if (Math.sqrt((n.x - mx) ** 2 + (n.y - my) ** 2) < n.r + 4) {
          setSelected(allResearchers.find(r => r.id === n.id) || null);
        }
      });
    };

    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('click', onClick);
    return () => {
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('click', onClick);
      cancelAnimationFrame(animRef.current);
    };
  }, [allResearchers]);

  return (
    <PageLayout>
      <TopBar title="Co-authorship Network" subtitle="Publication collaboration graph — AHEAD & HCOR" />
      <PageContent>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
          {/* Network canvas */}
          <div className="lg:col-span-3 space-y-4">
            <Card className="!p-3">
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
                  className="px-3 py-1.5 text-sm rounded-md border border-gray-300 bg-white focus:border-brand-500 outline-none">
                  <option value="">All Departments</option>
                  <option value="AHEAD">AHEAD only</option>
                  <option value="HCOR">HCOR only</option>
                </select>
                <select value={minCoauth} onChange={e => setMinCoauth(Number(e.target.value))}
                  className="px-3 py-1.5 text-sm rounded-md border border-gray-300 bg-white focus:border-brand-500 outline-none">
                  <option value={1}>Min 1 co-authored</option>
                  <option value={2}>Min 2 co-authored</option>
                  <option value={3}>Min 3 co-authored</option>
                </select>
                <div className="flex items-center gap-4 ml-auto text-xs text-gray-500">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-brand-500 inline-block" /> AHEAD</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-teal-500 inline-block" /> HCOR</span>
                  <span>Node size = publication count · Edge weight = co-authored papers</span>
                </div>
              </div>
              {loading ? (
                <div className="flex items-center justify-center h-[440px]"><Spinner size="lg" /></div>
              ) : (
                <div className="relative rounded-xl overflow-hidden bg-gray-50 border border-gray-100" style={{ height: 480 }}>
                  <canvas ref={canvasRef} className="w-full h-full" />
                </div>
              )}
            </Card>

            {/* Top pairs */}
            <Card>
              <CardHeader><CardTitle>Top Collaborating Pairs</CardTitle></CardHeader>
              <div className="grid grid-cols-2 gap-3">
                {topPairs.map((p, i) => (
                  <div key={i} className="flex items-center gap-2.5 p-3 rounded-lg bg-gray-50 border border-gray-100">
                    <div className="flex -space-x-2">
                      {[p.rA, p.rB].map((r, j) => (
                        <div key={j} className="w-8 h-8 rounded-full bg-brand-100 border-2 border-white flex items-center justify-center">
                          <span className="text-brand-700 text-[10px] font-bold">
                            {r.canonicalName.split(' ').map((w: string) => w[0]).slice(0, 2).join('')}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 truncate">
                        {p.rA.canonicalName.split(' ').slice(-1)[0]} & {p.rB.canonicalName.split(' ').slice(-1)[0]}
                      </p>
                      <p className="text-[10px] text-gray-500 mt-0.5">{p.count} co-authored paper{p.count > 1 ? 's' : ''}</p>
                    </div>
                    <span className="text-lg font-bold font-display text-brand-700">{p.count}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Selected researcher details */}
            {selected && (
              <Card>
                <CardHeader>
                  <CardTitle>Selected Researcher</CardTitle>
                  <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
                </CardHeader>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center">
                    <span className="text-brand-700 text-sm font-bold">
                      {selected.canonicalName.split(' ').map((p: string) => p[0]).slice(0, 2).join('')}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{selected.canonicalName}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${departmentColor(selected.department)}`}>
                      {selected.department}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[
                    { label: 'Pubs', value: selected.publicationCount },
                    { label: 'Citations', value: selected.totalCitations },
                    { label: 'h-index', value: selected.hIndex },
                  ].map(s => (
                    <div key={s.label} className="bg-gray-50 rounded-lg p-2 text-center">
                      <div className="text-base font-bold font-display text-gray-900">{s.value}</div>
                      <div className="text-[10px] text-gray-500">{s.label}</div>
                    </div>
                  ))}
                </div>
                <Link href={`/researchers/${selected.id}`}>
                  <Button variant="outline" size="sm" className="w-full">View Full Profile →</Button>
                </Link>
              </Card>
            )}

            {/* Most connected */}
            <Card>
              <CardHeader><CardTitle>Most Connected</CardTitle></CardHeader>
              <div className="space-y-2">
                {topCollaborators.map((r, i) => (
                  <div key={r.id} className="flex items-center gap-2.5 cursor-pointer hover:bg-gray-50 rounded-lg p-1.5 transition-colors"
                    onClick={() => setSelected(r)}>
                    <span className="w-5 text-center text-xs font-bold text-gray-300">{i + 1}</span>
                    <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-brand-700 text-[10px] font-bold">
                        {r.canonicalName.split(' ').map((p: string) => p[0]).slice(0, 2).join('')}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 truncate">{r.canonicalName}</p>
                      <p className="text-[10px] text-gray-400">{r.department}</p>
                    </div>
                    <span className="text-xs font-bold text-brand-700">{r.degree}</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Network legend */}
            <Card>
              <CardTitle className="mb-3">How to Use</CardTitle>
              <div className="space-y-2 text-xs text-gray-500">
                <p>🖱 <strong>Drag</strong> nodes to rearrange</p>
                <p>👆 <strong>Click</strong> a node to see details</p>
                <p>📏 <strong>Edge thickness</strong> = collaboration strength</p>
                <p>⭕ <strong>Node size</strong> = publication count</p>
              </div>
            </Card>
          </div>
        </div>
      </PageContent>

      {/* Tooltip */}
      <div ref={tooltipRef} className="fixed z-50 pointer-events-none bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs shadow-lg" style={{ display: 'none' }} />
    </PageLayout>
  );
}
