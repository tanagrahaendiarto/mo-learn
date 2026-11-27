"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { RelationshipGraph, RelationshipNode } from "@/types/molearn";
import { ENTITY_TYPE_LABELS } from "@/types/molearn";
import { EntityBadge } from "@/components/EntityBadge";
import { PixelCard } from "@/components/PixelCard";

/**
 * RelationshipExplorer — visualisasi relasi biologis (Task D).
 *
 * Model data (`RelationshipGraph`) INDEPENDEN dari visualisasi: komponen
 * ini memakai layout SVG ringan sekarang, sehingga Cytoscape.js dapat
 * menggantinya nanti tanpa mengubah model.
 *
 * Dua jalur:
 *  - SVG map (pointer/visual) untuk memilih node.
 *  - Daftar tekstual (selalu dirender) = fallback aksesibel; setiap node
 *    dan relasi dapat dibuka/dipilih lewat keyboard via link.
 *
 * Relasi tidak pernah disimpulkan dari kemiripan simbol; label + sumber
 * + evidence datang dari data yang diberikan.
 */

function nodeHref(node: RelationshipNode): string {
  return `/entity/${node.type}/${encodeURIComponent(node.id)}`;
}

const NODE_FILL: Record<RelationshipNode["type"], string> = {
  gene: "#ceffac", // secondary-container
  protein: "#e3f3ff", // tertiary-container
};

export function RelationshipExplorer({ graph }: { graph: RelationshipGraph }) {
  const [selectedKey, setSelectedKey] = useState<string | null>(
    graph.nodes[0]?.key ?? null,
  );
  const selected =
    graph.nodes.find((n) => n.key === selectedKey) ?? null;

  const positions = useMemo(() => {
    const n = graph.nodes.length;
    const cx = 160;
    const cy = 160;
    const r = n <= 1 ? 0 : 105;
    return graph.nodes.map((node, i) => {
      const angle = (Math.PI * 2 * i) / Math.max(n, 1) - Math.PI / 2;
      return {
        key: node.key,
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle),
      };
    });
  }, [graph.nodes]);

  const posMap = new Map(positions.map((p) => [p.key, p]));
  const byKey = new Map(graph.nodes.map((n) => [n.key, n]));

  return (
    <div className="grid grid-cols-1 gap-lg lg:grid-cols-2">
      {/* Visual map (pointer aid; the list below is the accessible path). */}
      <PixelCard className="p-md">
        <div className="mb-sm flex items-center justify-between gap-sm">
          <h3 className="font-label text-label-sm text-on-surface-variant">
            Relationship map
          </h3>
          <span className="font-body text-body-sm text-on-surface-variant">
            Tap a node to select it
          </span>
        </div>
        <svg
          viewBox="0 0 320 320"
          role="img"
          aria-label="Relationship map. The list below provides the same relationships in text."
          className="w-full"
        >
          {graph.edges.map((e) => {
            const a = posMap.get(e.from);
            const b = posMap.get(e.to);
            if (!a || !b) return null;
            return (
              <g key={e.id}>
                <line
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke="#244d38"
                  strokeWidth={2}
                  strokeDasharray={e.label === "homolog" ? "4 3" : undefined}
                />
                <text
                  x={(a.x + b.x) / 2}
                  y={(a.y + b.y) / 2}
                  fontSize={10}
                  fill="#55584c"
                  textAnchor="middle"
                >
                  {e.label}
                </text>
              </g>
            );
          })}
          {graph.nodes.map((n) => {
            const p = posMap.get(n.key);
            if (!p) return null;
            const isSel = n.key === selectedKey;
            return (
              <g
                key={n.key}
                onClick={() => setSelectedKey(n.key)}
                className="cursor-pointer"
                aria-hidden="true"
              >
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={20}
                  fill={NODE_FILL[n.type]}
                  stroke={isSel ? "#244d38" : "#25322b"}
                  strokeWidth={isSel ? 3 : 1}
                />
                <text
                  x={p.x}
                  y={p.y}
                  fontSize={11}
                  fill="#25322b"
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {n.symbol ?? n.id}
                </text>
              </g>
            );
          })}
        </svg>
      </PixelCard>

      <div className="flex flex-col gap-lg">
        {/* Textual relationship list (always rendered). */}
        <PixelCard className="p-md">
          <h3 className="mb-sm font-label text-label-sm text-on-surface-variant">
            Relationships
          </h3>
          {graph.edges.length > 0 ? (
            <ul className="flex flex-col gap-md">
              {graph.edges.map((e) => {
                const from = byKey.get(e.from);
                const to = byKey.get(e.to);
                if (!from || !to) return null;
                return (
                  <li
                    key={e.id}
                    className="flex flex-col gap-xs border-b border-outline-subtle pb-md last:border-b-0 last:pb-0"
                  >
                    <p className="font-body text-body-sm text-on-surface-card">
                      <Link
                        href={nodeHref(from)}
                        className="font-label text-label-md text-primary hover:underline"
                      >
                        {from.symbol ?? from.id}
                      </Link>{" "}
                      <span className="font-label text-label-md text-on-surface-variant">
                        — {e.label} —
                      </span>{" "}
                      <Link
                        href={nodeHref(to)}
                        className="font-label text-label-md text-primary hover:underline"
                      >
                        {to.symbol ?? to.id}
                      </Link>
                    </p>
                    <p className="font-body text-body-sm text-on-surface-variant">
                      Source: {e.source}
                      {e.evidence ? ` · ${e.evidence}` : ""}
                    </p>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="font-body text-body-sm text-on-surface-variant">
              No relationships available for this entity.
            </p>
          )}
        </PixelCard>

        {/* Selected node details. */}
        {selected && (
          <PixelCard className="p-md">
            <div className="mb-sm flex items-center justify-between gap-sm">
              <h3 className="font-label text-label-sm text-on-surface-variant">
                Selected node
              </h3>
              <EntityBadge type={selected.type} />
            </div>
            <h4 className="font-headline text-headline-sm text-on-surface-card">
              {selected.name}
            </h4>
            <p className="font-mono text-mono-sm text-primary">
              {selected.symbol ?? selected.id} • {selected.id}
            </p>
            {selected.organism && (
              <p className="font-body text-body-sm text-on-surface-variant italic">
                {selected.organism}
              </p>
            )}
            {selected.isDemo && (
              <p className="mt-xs font-label text-label-sm text-on-amber-container">
                Demo data
              </p>
            )}
            <div className="mt-sm">
              <Link
                href={nodeHref(selected)}
                className="inline-flex items-center gap-xs rounded-md border border-outline-subtle bg-primary px-md py-xs font-label text-label-md text-on-primary shadow-card-sm hover:bg-secondary hover:text-on-secondary"
              >
                Open {ENTITY_TYPE_LABELS[selected.type]} Profile
              </Link>
            </div>
          </PixelCard>
        )}
      </div>
    </div>
  );
}
