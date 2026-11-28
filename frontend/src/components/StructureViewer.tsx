"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { StructureRecord } from "@/lib/exploration";
import {
  allowedCoordinateUrl,
  ATOM_LIMIT,
  BYTE_LIMIT,
  FETCH_TIMEOUT_MS,
  describeCoordinates,
  formatResidueIdentity,
  pickTargetChains,
  type ResidueIdentity,
} from "@/lib/structure-viewer-rules";

type Plugin = import("molstar/lib/mol-plugin/context").PluginContext;
type Structure = import("molstar/lib/mol-model/structure/structure/structure").Structure;

const REPRESENTATION = { cartoon: "cartoon", stick: "ball-and-stick" } as const;
type Representation = keyof typeof REPRESENTATION;

const TARGET_COLOR = 0x2f6f4f;

/** Fetch coordinates ourselves: bounded time, streamed size cap, no redirects, no credentials. */
async function downloadCoordinates(url: string, signal: AbortSignal): Promise<string> {
  if (!allowedCoordinateUrl(url)) throw new Error("coordinate_source_not_allowed");
  const response = await fetch(url, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(FETCH_TIMEOUT_MS)]),
    credentials: "omit",
    referrerPolicy: "no-referrer",
    redirect: "error",
  });
  if (!response.ok) throw new Error(`coordinate_fetch_${response.status}`);
  if (!response.body) throw new Error("coordinate_fetch_empty");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > BYTE_LIMIT) {
      await reader.cancel();
      throw new Error("coordinate_too_large");
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

function describeError(cause: unknown): string {
  const message = cause instanceof Error ? cause.message : "";
  if (message.includes("webgl_unavailable")) return "WebGL is not available in this browser";
  if (message.includes("coordinate_too_large")) return "the coordinate file exceeds the size limit";
  if (message.includes("structure_too_large")) return "the expanded structure exceeds the atom limit";
  if (message.includes("coordinate_fetch")) return "the coordinate download failed";
  if (message.includes("not_allowed")) return "the coordinate source is not an approved provider";
  if (message.includes("assembly_missing")) return "the requested assembly is not defined in this file";
  return "the structure could not be displayed";
}

/** Structure model → unique chains, keyed by label + author identifiers. */
function chainTable(structure: Structure) {
  const { chains } = structure.model.atomicHierarchy;
  const { entities } = structure.model;
  const rows: { labelAsymId: string; authAsymId: string; polymer: boolean }[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < chains._rowCount; i++) {
    const labelAsymId = chains.label_asym_id.value(i);
    const authAsymId = chains.auth_asym_id.value(i);
    const entityId = chains.label_entity_id.value(i);
    const key = `${labelAsymId}\u0000${authAsymId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const entityType = entities.data.type.value(entities.getEntityIndex(entityId));
    rows.push({ labelAsymId, authAsymId, polymer: entityType === "polymer" });
  }
  return rows;
}

export function StructureViewer({ record }: { record: StructureRecord }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const pluginRef = useRef<Plugin | null>(null);
  const cifRef = useRef<string | null>(null);
  const generation = useRef(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [residue, setResidue] = useState<ResidueIdentity | null>(null);
  const [representation, setRepresentation] = useState<Representation>("cartoon");
  const [targetOnly, setTargetOnly] = useState(false);
  const [smallMolecules, setSmallMolecules] = useState(true);
  const [assemblyIds, setAssemblyIds] = useState<string[]>([]);
  const [assemblyId, setAssemblyId] = useState<string | null>(null);
  const [targetChains, setTargetChains] = useState<string[]>([]);
  const [atomCount, setAtomCount] = useState<number | null>(null);

  const coordinateUrl = useMemo(
    () => record.downloads.find((download) => download.format === "mmCIF")?.url ?? null,
    [record],
  );
  // A record without an approved coordinate source never mounts a viewer; fallback text stays.
  const view = coordinateUrl ? status : "error";

  useEffect(() => {
    const controller = new AbortController();
    const counter = generation;
    const mine = ++counter.current;
    const stale = () => mine !== counter.current || controller.signal.aborted;
    if (!coordinateUrl) return () => controller.abort();

    void (async () => {
      try {
        const text = await downloadCoordinates(coordinateUrl, controller.signal);
        if (stale()) return;
        const [{ PluginContext }, { DefaultPluginSpec }] = await Promise.all([
          import("molstar/lib/mol-plugin/context"),
          import("molstar/lib/mol-plugin/spec"),
        ]);
        if (stale()) return;

        const host = hostRef.current;
        if (!host) return;
        await destroy(pluginRef.current);
        pluginRef.current = null;
        host.replaceChildren();

        const plugin = new PluginContext(DefaultPluginSpec());
        await plugin.init();
        const canvas = document.createElement("canvas");
        const parent = document.createElement("div");
        Object.assign(parent.style, { position: "absolute", inset: "0" });
        parent.appendChild(canvas);
        host.appendChild(parent);
        if (!(await plugin.initViewerAsync(canvas, parent))) {
          plugin.dispose();
          host.replaceChildren();
          throw new Error("webgl_unavailable");
        }
        if (stale()) {
          plugin.dispose();
          host.replaceChildren();
          return;
        }
        pluginRef.current = plugin;

        // Remember the parsed text so assembly changes rebuild from the same trusted bytes.
        cifRef.current = text;
        const { ModelSymmetry } = await import("molstar/lib/mol-model-formats/structure/property/symmetry");
        const probeData = await plugin.builders.data.rawData({ data: text, label: record.source_id });
        const probeTrajectory = await plugin.builders.structure.parseTrajectory(probeData, "mmcif");
        const probeModel = await plugin.builders.structure.createModel(probeTrajectory);
        const assemblies = probeModel.data ? ModelSymmetry.Provider.get(probeModel.data)?.assemblies ?? [] : [];
        const ids = record.kind === "predicted" ? [] : assemblies.map((assembly) => assembly.id);

        const built = await applyStructure(plugin, text, record.source_id, null, record.coverage);
        if (stale()) return;
        setTargetChains(built.targets);
        setAtomCount(built.atoms);
        setAssemblyIds(ids);
        setStatus("ready");
      } catch (cause) {
        if (stale()) return;
        if (process.env.NODE_ENV !== "production") console.error("[structure-viewer]", cause);
        setError(describeError(cause));
        setStatus("error");
      }
    })();

    return () => {
      controller.abort();
      counter.current++;
    };
  }, [coordinateUrl, record]);

  useEffect(() => {
    const plugin = pluginRef.current;
    if (!plugin || status !== "ready") return;
    const sub = plugin.behaviors.interaction.click.subscribe((event) => {
      const loci = event.current?.loci;
      if (!loci) return;
      void readResidue(loci)
        .then((next) => { if (next) setResidue(next); })
        .catch(() => { /* a click must never break the viewer */ });
    });
    return () => sub.unsubscribe();
  }, [status]);

  useEffect(() => {
    const plugin = pluginRef.current;
    const host = hostRef.current;
    if (!plugin || !host || status !== "ready") return;
    const observer = new ResizeObserver(() => plugin.handleResize());
    observer.observe(host);
    return () => observer.disconnect();
  }, [status]);

  useEffect(() => () => {
    generation.current++;
    void destroy(pluginRef.current);
    pluginRef.current = null;
  }, []);

  const reset = useCallback(() => pluginRef.current?.managers.camera.reset(undefined, 250), []);

  const focusTarget = useCallback(() => {
    const plugin = pluginRef.current;
    const component = plugin?.managers.structure.hierarchy.current.structures[0]
      ?.components.find((candidate) => candidate.key === "target");
    const structure = component?.cell.obj?.data;
    if (!plugin || !structure) return;
    void (async () => {
      const { StructureElement } = await import("molstar/lib/mol-model/structure");
      plugin.managers.camera.focusLoci(StructureElement.Loci.all(structure));
    })();
  }, []);

  const changeRepresentation = useCallback((next: Representation) => {
    setRepresentation(next);
    void (async () => {
      const plugin = pluginRef.current;
      const structureRef = plugin?.managers.structure.hierarchy.current.structures[0];
      if (!plugin || !structureRef) return;
      for (const key of ["target", "other-polymer"]) {
        const component = structureRef.components.find((candidate) => candidate.key === key);
        if (!component?.cell.obj) continue;
        await plugin.managers.structure.component.removeRepresentations([component]);
        await plugin.builders.structure.representation.addRepresentation(component.cell, {
          type: REPRESENTATION[next],
          color: key === "target" ? "uniform" : "chain-id",
          ...(key === "target" ? { colorParams: { value: TARGET_COLOR } } : {}),
        });
      }
    })();
  }, []);

  const changeTargetOnly = useCallback((next: boolean) => {
    setTargetOnly(next);
    const plugin = pluginRef.current;
    const other = plugin?.managers.structure.hierarchy.current.structures[0]
      ?.components.find((candidate) => candidate.key === "other-polymer");
    if (plugin && other) void plugin.managers.structure.hierarchy.toggleVisibility([other], next ? "hide" : "show");
  }, []);

  const changeSmallMolecules = useCallback((next: boolean) => {
    setSmallMolecules(next);
    const plugin = pluginRef.current;
    const structureRef = plugin?.managers.structure.hierarchy.current.structures[0];
    if (!plugin || !structureRef) return;
    for (const key of ["small-molecule", "water"]) {
      const component = structureRef.components.find((candidate) => candidate.key === key);
      if (component) void plugin.managers.structure.hierarchy.toggleVisibility([component], next ? "show" : "hide");
    }
  }, []);

  const changeAssembly = useCallback((next: string | null) => {
    void (async () => {
      const plugin = pluginRef.current;
      const cif = cifRef.current;
      if (!plugin || !cif) return;
      setStatus("loading");
      setError(null);
      setResidue(null);
      const mine = ++generation.current;
      try {
        const built = await applyStructure(plugin, cif, record.source_id, next, record.coverage);
        if (mine !== generation.current) return;
        setTargetChains(built.targets);
        setAtomCount(built.atoms);
        setAssemblyId(next);
        setTargetOnly(false);
        setStatus("ready");
      } catch (cause) {
        if (mine !== generation.current) return;
        if (process.env.NODE_ENV !== "production") console.error("[structure-viewer]", cause);
        setError(describeError(cause));
        setStatus("error");
      }
    })();
  }, [record]);

  const hasTargets = targetChains.length > 0;

  return (
    <section className="flex min-w-0 flex-col gap-sm" aria-label="Interactive 3D structure viewer">
      <div className="flex flex-wrap items-center gap-sm text-body-sm text-on-surface-variant">
        <span>{describeCoordinates(record.kind, assemblyId)}</span>
        {atomCount !== null && <span>· {atomCount.toLocaleString()} rendered atoms</span>}
        {hasTargets && <span>· Target protein chain{targetChains.length > 1 ? "s" : ""}: {targetChains.join(", ")}</span>}
      </div>
      <div className="relative h-[360px] w-full min-w-0 overflow-hidden rounded-md border border-outline-subtle bg-[#FCFBF9] md:h-[480px]">
        <div ref={hostRef} className="absolute inset-0" aria-hidden="true" data-testid="molstar-host" />
        {view === "loading" && (
          <p role="status" className="absolute inset-0 flex items-center justify-center text-body-sm">Loading 3D structure…</p>
        )}
        {view === "error" && (
          <p role="status" className="absolute inset-0 flex items-center justify-center px-md text-center text-body-sm">
            Interactive 3D view unavailable: {error}. The structure details, preview and download links still apply.
          </p>
        )}
      </div>
      {view === "ready" && (
        <div className="flex flex-wrap items-center gap-sm text-body-sm">
          <ViewerButton label="Reset view" onClick={reset} />
          <ViewerButton label="Focus target" onClick={focusTarget} disabled={!hasTargets} />
          <ViewerButton
            label={representation === "cartoon" ? "Show sticks" : "Show cartoon"}
            onClick={() => changeRepresentation(representation === "cartoon" ? "stick" : "cartoon")}
          />
          <label className="flex items-center gap-xs">
            <input type="checkbox" checked={targetOnly} disabled={!hasTargets} onChange={(event) => changeTargetOnly(event.target.checked)} />
            Show target only
          </label>
          <label className="flex items-center gap-xs">
            <input type="checkbox" checked={smallMolecules} onChange={(event) => changeSmallMolecules(event.target.checked)} />
            Show small molecules, ions and water
          </label>
          {record.kind === "experimental" && (
            <label className="flex items-center gap-xs">
              Coordinates
              <select
                className="max-w-full rounded-md border border-outline-subtle bg-surface p-xs"
                value={assemblyId ?? "deposited"}
                onChange={(event) => changeAssembly(event.target.value === "deposited" ? null : event.target.value)}
              >
                <option value="deposited">Deposited coordinates (asymmetric unit)</option>
                {assemblyIds.map((id) => <option key={id} value={id}>Biological assembly {id}</option>)}
              </select>
            </label>
          )}
        </div>
      )}
      <p className="text-body-sm text-on-surface-variant" aria-live="polite" data-testid="residue-identity">
        {residue
          ? `Selected ${formatResidueIdentity(residue)}`
          : "Click a residue in the viewer to read its author chain, author number, label chain and label sequence number."}
      </p>
      <p className="text-body-sm text-on-surface-variant">
        Drag to rotate, scroll to zoom, right-drag to pan. Coordinates load from the source provider only while this module is open.
      </p>
    </section>
  );
}

function ViewerButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="rounded-md border border-outline-subtle px-sm py-xs disabled:opacity-50">
      {label}
    </button>
  );
}

/** Build one structure with target/other/ligand/water components; never relabel coordinates as an assembly. */
async function applyStructure(
  plugin: Plugin,
  cif: string,
  label: string,
  assemblyId: string | null,
  coverage: readonly { chain: string }[],
): Promise<{ targets: string[]; atoms: number }> {
  await plugin.clear();
  const data = await plugin.builders.data.rawData({ data: cif, label });
  const trajectory = await plugin.builders.structure.parseTrajectory(data, "mmcif");
  // createStructure needs a Model ref; passing raw model data fails with "Could not find node 'undefined'".
  const model = await plugin.builders.structure.createModel(trajectory);
  const structure = await plugin.builders.structure.createStructure(
    model,
    assemblyId ? { name: "assembly", params: { id: assemblyId } } : { name: "model", params: {} },
  );
  const structureData = structure.cell?.obj?.data;
  if (!structureData) throw new Error("structure_unavailable");
  // Only claim an assembly when Mol* actually built one with that id.
  if (assemblyId && structure.cell?.obj?.label !== `Assembly ${assemblyId}`) {
    await plugin.clear();
    throw new Error("assembly_missing");
  }
  if (structureData.elementCount > ATOM_LIMIT) {
    await plugin.clear();
    throw new Error("structure_too_large");
  }

  const chains = chainTable(structureData);
  const targets = pickTargetChains(chains, coverage);
  const targetAuth = new Set(chains.filter((c) => targets.includes(c.labelAsymId)).map((c) => c.authAsymId));
  const otherAuth = new Set(chains.filter((c) => c.polymer && !targets.includes(c.labelAsymId)).map((c) => c.authAsymId));

  const { MolScriptBuilder: MS } = await import("molstar/lib/mol-script/language/builder");
  const byAuth = (ids: string[]) => MS.core.set.has([MS.set(...ids), MS.ammp("auth_asym_id")]);

  const target = targetAuth.size > 0
    ? await plugin.builders.structure.tryCreateComponentFromExpression(
      structure, MS.struct.generator.atomGroups({ "chain-test": byAuth([...targetAuth]) }), "target", { label: "Target protein" })
    : undefined;
  const other = otherAuth.size > 0
    ? await plugin.builders.structure.tryCreateComponentFromExpression(
      structure, MS.struct.generator.atomGroups({ "chain-test": byAuth([...otherAuth]) }), "other-polymer", { label: "Other polymers" })
    : undefined;
  const small = await plugin.builders.structure.tryCreateComponentStatic(structure, "ligand", { label: "Small molecules and ions" });
  const water = await plugin.builders.structure.tryCreateComponentStatic(structure, "water", { label: "Water" });

  const builder = plugin.builders.structure.representation;
  if (target) await builder.addRepresentation(target, { type: "cartoon", color: "uniform", colorParams: { value: TARGET_COLOR } });
  if (other) await builder.addRepresentation(other, { type: "cartoon", color: "chain-id" });
  if (small) await builder.addRepresentation(small, { type: "ball-and-stick", color: "element-symbol" });
  if (water) await builder.addRepresentation(water, { type: "ball-and-stick", color: "element-symbol", size: "uniform", sizeParams: { value: 0.2 } });

  plugin.managers.camera.reset(undefined, 0);
  return { targets, atoms: structureData.elementCount };
}

/** Click loci can be a bond, shape or empty loci; only element-loci describe a residue. */
function isElementLoci(loci: unknown): boolean {
  return !!loci && (loci as { kind?: string }).kind === "element-loci";
}

async function readResidue(loci: import("molstar/lib/mol-model/loci").Loci): Promise<ResidueIdentity | null> {
  if (!isElementLoci(loci)) return null;
  const { StructureElement, StructureProperties } = await import("molstar/lib/mol-model/structure");
  const location = StructureElement.Loci.getFirstLocation(loci as never);
  if (!location) return null;
  const labelSeq = StructureProperties.residue.label_seq_id(location);
  const copy = StructureProperties.unit.operator_name(location);
  return {
    comp: StructureProperties.atom.label_comp_id(location),
    authChain: StructureProperties.chain.auth_asym_id(location),
    labelChain: StructureProperties.chain.label_asym_id(location),
    authSeq: StructureProperties.residue.auth_seq_id(location),
    labelSeq: Number.isFinite(labelSeq) ? labelSeq : 0,
    insCode: StructureProperties.residue.pdbx_PDB_ins_code(location) ?? "",
    model: location.unit.model.modelNum,
    copy: copy && copy !== "1_555" ? copy : null,
  };
}

async function destroy(plugin: Plugin | null) {
  if (!plugin) return;
  try {
    await plugin.clear();
  } catch {
    /* state may already be disposed */
  }
  plugin.dispose();
}
