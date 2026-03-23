'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { PageLayout, PageContent, TopBar } from '@/components/layout';
import { Card, CardHeader, CardTitle, Button, Spinner } from '@/components/ui';
import { fetchJsonCached } from '@/lib/client-cache';
import { departmentColor } from '@/lib/utils';

interface Node {
  id: string;
  name: string;
  department: string;
  publicationCount: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  degree: number;
}

interface Edge {
  source: string;
  target: string;
  weight: number;
}

export default function CollaborationsPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const nodesRef = useRef<Node[]>([]);
  const edgesRef = useRef<Edge[]>([]);
  const draggingRef = useRef<Node | null>(null);
  const dragMovedRef = useRef(false);
  const dragOriginRef = useRef<{ x: number; y: number } | null>(null);
  const hoveredRef = useRef<Node | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<any>(null);

  const [deptFilter, setDeptFilter] = useState('');
  const [minCoauth, setMinCoauth] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [topPairs, setTopPairs] = useState<any[]>([]);
  const [topCollaborators, setTopCollaborators] = useState<any[]>([]);
  const [allResearchers, setAllResearchers] = useState<any[]>([]);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  const buildNetwork = useCallback((researchers: any[], publications: any[]) => {
    const edgeCounts: Record<string, number> = {};

    publications.forEach((publication: any) => {
      const researcherIds = publication.matchedResearchers.map((match: any) => match.id);
      for (let i = 0; i < researcherIds.length; i++) {
        for (let j = i + 1; j < researcherIds.length; j++) {
          const key = [researcherIds[i], researcherIds[j]].sort().join('|');
          edgeCounts[key] = (edgeCounts[key] || 0) + 1;
        }
      }
    });

    const width = canvasRef.current?.offsetWidth || 920;
    const height = canvasRef.current?.offsetHeight || 520;

    const filteredResearchers = deptFilter
      ? researchers.filter(researcher => researcher.department === deptFilter)
      : researchers;

    const filteredEdges = Object.entries(edgeCounts)
      .filter(([, weight]) => weight >= minCoauth)
      .map(([key, weight]) => {
        const [source, target] = key.split('|');
        return { source, target, weight };
      })
      .filter(edge =>
        filteredResearchers.some(researcher => researcher.id === edge.source) &&
        filteredResearchers.some(researcher => researcher.id === edge.target),
      );

    const degreeMap: Record<string, number> = {};
    filteredEdges.forEach(edge => {
      degreeMap[edge.source] = (degreeMap[edge.source] || 0) + 1;
      degreeMap[edge.target] = (degreeMap[edge.target] || 0) + 1;
    });

    const maxPublications = Math.max(...filteredResearchers.map(researcher => researcher.publicationCount || 0), 1);
    const deptCounts = {
      AHEAD: Math.max(filteredResearchers.filter(researcher => researcher.department === 'AHEAD').length, 1),
      HCOR: Math.max(filteredResearchers.filter(researcher => researcher.department === 'HCOR').length, 1),
    };
    const deptIndex = { AHEAD: 0, HCOR: 0 };
    const sharedCenterY = height * 0.52;

    nodesRef.current = filteredResearchers.map(researcher => {
      const department = researcher.department === 'HCOR' ? 'HCOR' : 'AHEAD';
      const index = deptIndex[department]++;
      const angle = (index / deptCounts[department]) * Math.PI * 2;
      const laneCenterX =
        deptFilter === 'AHEAD' || deptFilter === 'HCOR'
          ? width / 2
          : department === 'AHEAD'
            ? width * 0.36
            : width * 0.64;
      const orbit = 68 + (index % 5) * 18;
      const radiusScale = Math.sqrt((researcher.publicationCount || 1) / maxPublications);

      return {
        id: researcher.id,
        name: researcher.canonicalName,
        department: researcher.department,
        publicationCount: researcher.publicationCount,
        x: laneCenterX + Math.cos(angle) * orbit + (Math.random() - 0.5) * 18,
        y: sharedCenterY + Math.sin(angle) * orbit + (Math.random() - 0.5) * 18,
        vx: 0,
        vy: 0,
        r: 15 + radiusScale * 18,
        degree: degreeMap[researcher.id] || 0,
      };
    });

    edgesRef.current = filteredEdges;

    const pairs = Object.entries(edgeCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([key, count]) => {
        const [aId, bId] = key.split('|');
        const rA = researchers.find(researcher => researcher.id === aId);
        const rB = researchers.find(researcher => researcher.id === bId);
        return { rA, rB, count };
      })
      .filter(pair => pair.rA && pair.rB);
    setTopPairs(pairs);

    const connectedResearchers = filteredResearchers
      .map(researcher => ({ ...researcher, degree: degreeMap[researcher.id] || 0 }))
      .sort((a, b) => b.degree - a.degree)
      .slice(0, 6);
    setTopCollaborators(connectedResearchers);
  }, [deptFilter, minCoauth]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const params = new URLSearchParams();
    if (deptFilter) params.set('department', deptFilter);

    fetchJsonCached<any[]>(`/api/researchers?${params}`)
      .then(async researchers => {
        if (cancelled) return;
        setAllResearchers(researchers);
        const publicationData = await fetchJsonCached<any>('/api/publications?pageSize=200');
        if (cancelled) return;
        buildNetwork(researchers, publicationData.data || []);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [deptFilter, minCoauth, buildNetwork]);

  const startAnimation = useCallback(() => {
    cancelAnimationFrame(animRef.current);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const context = ctx;
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);

    const departmentColors: Record<string, string> = { AHEAD: '#1a6fb5', HCOR: '#14b8a6' };

    function tick() {
      animRef.current = requestAnimationFrame(tick);

      const nodes = nodesRef.current;
      const edges = edgesRef.current;
      const hovered = hoveredRef.current;

      nodes.forEach(node => {
        if (node === draggingRef.current) {
          node.vx = 0;
          node.vy = 0;
          return;
        }
        node.vx *= 0.9;
        node.vy *= 0.9;
        const targetX =
          deptFilter === 'AHEAD' || deptFilter === 'HCOR'
            ? width / 2
            : node.department === 'AHEAD'
              ? width * 0.36
              : width * 0.64;
        const targetY = height * 0.52;
        node.vx += (targetX - node.x) * 0.0025;
        node.vy += (targetY - node.y) * 0.0018;
      });

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;
          const minDistance = a.r + b.r + 18;
          const force = distance < minDistance ? (minDistance - distance) * 0.08 : Math.min(700 / (distance * distance), 1.8);
          const fx = (dx / distance) * force;
          const fy = (dy / distance) * force;
          a.vx -= fx;
          a.vy -= fy;
          b.vx += fx;
          b.vy += fy;
        }
      }

      edges.forEach(edge => {
        const source = nodes.find(node => node.id === edge.source);
        const target = nodes.find(node => node.id === edge.target);
        if (!source || !target) return;
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        const preferredDistance = Math.max(88, 146 - edge.weight * 11);
        const force = (distance - preferredDistance) * 0.02;
        const fx = (dx / distance) * force;
        const fy = (dy / distance) * force;
        source.vx += fx;
        source.vy += fy;
        target.vx -= fx;
        target.vy -= fy;
      });

      nodes.forEach(node => {
        if (node === draggingRef.current) return;
        node.x += node.vx;
        node.y += node.vy;
        node.x = Math.max(node.r + 12, Math.min(width - node.r - 12, node.x));
        node.y = Math.max(node.r + 12, Math.min(height - node.r - 12, node.y));
      });

      context.clearRect(0, 0, width, height);

      if (!deptFilter) {
        context.fillStyle = 'rgba(26,111,181,0.04)';
        context.fillRect(28, 24, width / 2 - 42, height - 48);
        context.fillStyle = 'rgba(20,184,166,0.04)';
        context.fillRect(width / 2 + 14, 24, width / 2 - 42, height - 48);
      }

      edges.forEach(edge => {
        const source = nodes.find(node => node.id === edge.source);
        const target = nodes.find(node => node.id === edge.target);
        if (!source || !target) return;
        const highlighted = selectedRef.current && (selectedRef.current.id === source.id || selectedRef.current.id === target.id);
        context.beginPath();
        context.moveTo(source.x, source.y);
        context.lineTo(target.x, target.y);
        context.strokeStyle = highlighted
          ? 'rgba(37,99,235,0.58)'
          : `rgba(100,116,139,${Math.min(0.4, 0.18 + edge.weight * 0.07)})`;
        context.lineWidth = highlighted ? Math.min(2.8 + edge.weight * 0.6, 5.5) : Math.min(1.4 + edge.weight * 0.6, 3.6);
        context.stroke();
      });

      nodes.forEach((node, index) => {
        const color = departmentColors[node.department] || '#6b7280';
        const isSelected = selectedRef.current?.id === node.id;
        const isHovered = hovered?.id === node.id;
        const showLabel = isSelected || isHovered || index < 4;

        context.shadowBlur = isSelected ? 18 : isHovered ? 12 : 0;
        context.shadowColor = color;
        context.beginPath();
        context.arc(node.x, node.y, node.r, 0, Math.PI * 2);
        context.fillStyle = color + (isSelected ? '30' : '18');
        context.fill();
        context.strokeStyle = color;
        context.lineWidth = isSelected ? 3 : 2;
        context.stroke();
        context.shadowBlur = 0;

        context.fillStyle = color;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.font = `bold ${Math.max(10, Math.min(20, node.r * 0.46))}px DM Sans, sans-serif`;
        context.fillText(
          node.name
            .split(' ')
            .map((part: string) => part[0])
            .slice(0, 2)
            .join(''),
          node.x,
          node.y,
        );

        if (showLabel) {
          const label = node.name.split(' ').slice(-1)[0];
          const labelY = node.y + node.r + 15;
          const labelWidth = Math.max(48, label.length * 7);
          context.fillStyle = 'rgba(255,255,255,0.9)';
          context.fillRect(node.x - labelWidth / 2, labelY - 8, labelWidth, 15);
          context.fillStyle = '#475569';
          context.font = '11px DM Sans, sans-serif';
          context.fillText(label, node.x, labelY);
        }
      });
    }

    tick();
  }, [deptFilter]);

  useEffect(() => {
    if (!loading) {
      const frame = requestAnimationFrame(() => startAnimation());
      return () => cancelAnimationFrame(frame);
    }
  }, [loading, startAnimation]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onMouseMove = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      let found: Node | null = null;

      nodesRef.current.forEach(node => {
        if (Math.sqrt((node.x - mouseX) ** 2 + (node.y - mouseY) ** 2) < node.r + 8) {
          found = node;
        }
      });

      hoveredRef.current = found;

      if (tooltipRef.current) {
        if (found) {
          const activeNode: Node = found;
          tooltipRef.current.style.display = 'block';
          tooltipRef.current.style.left = `${event.clientX + 12}px`;
          tooltipRef.current.style.top = `${event.clientY - 36}px`;
          tooltipRef.current.innerHTML = `<strong>${activeNode.name}</strong><br/>${activeNode.department} | ${activeNode.publicationCount} pubs`;
          canvas.style.cursor = draggingRef.current ? 'grabbing' : 'pointer';
        } else {
          tooltipRef.current.style.display = 'none';
          canvas.style.cursor = draggingRef.current ? 'grabbing' : 'default';
        }
      }

      if (draggingRef.current) {
        if (dragOriginRef.current) {
          const movedDistance = Math.hypot(mouseX - dragOriginRef.current.x, mouseY - dragOriginRef.current.y);
          if (movedDistance > 6) {
            dragMovedRef.current = true;
          }
        }
        draggingRef.current.x = mouseX;
        draggingRef.current.y = mouseY;
        draggingRef.current.vx = 0;
        draggingRef.current.vy = 0;
      }
    };

    const onMouseDown = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      dragMovedRef.current = false;
      dragOriginRef.current = { x: mouseX, y: mouseY };
      nodesRef.current.forEach(node => {
        if (Math.sqrt((node.x - mouseX) ** 2 + (node.y - mouseY) ** 2) < node.r + 8) {
          draggingRef.current = node;
          canvas.style.cursor = 'grabbing';
        }
      });
    };

    const onMouseUp = () => {
      if (draggingRef.current && !dragMovedRef.current) {
        setSelected(allResearchers.find(researcher => researcher.id === draggingRef.current?.id) || null);
      }
      draggingRef.current = null;
      dragOriginRef.current = null;
      canvas.style.cursor = hoveredRef.current ? 'pointer' : 'default';
    };

    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseUp);

    return () => {
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mouseleave', onMouseUp);
      cancelAnimationFrame(animRef.current);
    };
  }, [allResearchers]);

  return (
    <PageLayout>
      <TopBar title="Co-authorship Network" subtitle="Publication collaboration graph - AHEAD and HCOR" />
      <PageContent>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-4">
          <div className="space-y-4 lg:col-span-3">
            <Card className="!p-3">
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <select
                  value={deptFilter}
                  onChange={event => setDeptFilter(event.target.value)}
                  className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-brand-500"
                >
                  <option value="">All Departments</option>
                  <option value="AHEAD">AHEAD only</option>
                  <option value="HCOR">HCOR only</option>
                </select>
                <select
                  value={minCoauth}
                  onChange={event => setMinCoauth(Number(event.target.value))}
                  className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-brand-500"
                >
                  <option value={1}>Min 1 co-authored</option>
                  <option value={2}>Min 2 co-authored</option>
                  <option value={3}>Min 3 co-authored</option>
                </select>
                <div className="ml-auto flex flex-wrap items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-3 w-3 rounded-full bg-brand-500" /> AHEAD
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-3 w-3 rounded-full bg-teal-500" /> HCOR
                  </span>
                  <span>Hover for names, click for details</span>
                </div>
              </div>

              {loading ? (
                <div className="flex h-[440px] items-center justify-center">
                  <Spinner size="lg" />
                </div>
              ) : (
                <div className="relative overflow-hidden rounded-xl border border-gray-100 bg-gray-50" style={{ height: 520 }}>
                  <canvas ref={canvasRef} className="h-full w-full" />
                </div>
              )}
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Collaborating Pairs</CardTitle>
              </CardHeader>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {topPairs.map((pair, index) => (
                  <div key={index} className="flex items-center gap-2.5 rounded-lg border border-gray-100 bg-gray-50 p-3">
                    <div className="flex -space-x-2">
                      {[pair.rA, pair.rB].map((researcher, pairIndex) => (
                        <div
                          key={pairIndex}
                          className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-brand-100"
                        >
                          <span className="text-[10px] font-bold text-brand-700">
                            {researcher.canonicalName
                              .split(' ')
                              .map((word: string) => word[0])
                              .slice(0, 2)
                              .join('')}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-gray-900">
                        {pair.rA.canonicalName.split(' ').slice(-1)[0]} and {pair.rB.canonicalName.split(' ').slice(-1)[0]}
                      </p>
                      <p className="mt-0.5 text-[10px] text-gray-500">
                        {pair.count} co-authored paper{pair.count > 1 ? 's' : ''}
                      </p>
                    </div>
                    <span className="font-display text-lg font-bold text-brand-700">{pair.count}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="space-y-4">
            {selected && (
              <Card>
                <CardHeader>
                  <CardTitle>Selected Researcher</CardTitle>
                  <button onClick={() => setSelected(null)} className="text-sm text-gray-400 hover:text-gray-600">
                    X
                  </button>
                </CardHeader>
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100">
                    <span className="text-sm font-bold text-brand-700">
                      {selected.canonicalName
                        .split(' ')
                        .map((part: string) => part[0])
                        .slice(0, 2)
                        .join('')}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{selected.canonicalName}</p>
                    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${departmentColor(selected.department)}`}>
                      {selected.department}
                    </span>
                  </div>
                </div>
                <div className="mb-3 grid grid-cols-3 gap-2">
                  {[
                    { label: 'Pubs', value: selected.publicationCount },
                    { label: 'Citations', value: selected.totalCitations },
                    { label: 'h-index', value: selected.hIndex },
                  ].map(stat => (
                    <div key={stat.label} className="rounded-lg bg-gray-50 p-2 text-center">
                      <div className="font-display text-base font-bold text-gray-900">{stat.value}</div>
                      <div className="text-[10px] text-gray-500">{stat.label}</div>
                    </div>
                  ))}
                </div>
                <Link href={`/researchers/${selected.id}`}>
                  <Button variant="outline" size="sm" className="w-full">View Full Profile</Button>
                </Link>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Most Connected</CardTitle>
              </CardHeader>
              <div className="space-y-2">
                {topCollaborators.map((researcher, index) => (
                  <div
                    key={researcher.id}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg p-1.5 transition-colors hover:bg-gray-50"
                    onClick={() => setSelected(researcher)}
                  >
                    <span className="w-5 text-center text-xs font-bold text-gray-300">{index + 1}</span>
                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-brand-100">
                      <span className="text-[10px] font-bold text-brand-700">
                        {researcher.canonicalName
                          .split(' ')
                          .map((part: string) => part[0])
                          .slice(0, 2)
                          .join('')}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-gray-900">{researcher.canonicalName}</p>
                      <p className="text-[10px] text-gray-400">{researcher.department}</p>
                    </div>
                    <span className="text-xs font-bold text-brand-700">{researcher.degree}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <CardTitle className="mb-3">How to Use</CardTitle>
              <div className="space-y-2 text-xs text-gray-500">
                <p>Drag nodes to rearrange the network.</p>
                <p>Click a node to open the researcher summary card.</p>
                <p>Hover a node to reveal the full name.</p>
                <p>Thicker lines indicate stronger collaboration links.</p>
              </div>
            </Card>
          </div>
        </div>
      </PageContent>

      <div
        ref={tooltipRef}
        className="pointer-events-none fixed z-50 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-lg"
        style={{ display: 'none' }}
      />
    </PageLayout>
  );
}
