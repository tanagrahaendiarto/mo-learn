/** Pure rules for the structure viewer: trusted coordinate sources and scientific label mapping. */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  allowedCoordinateUrl,
  ATOM_LIMIT,
  FETCH_TIMEOUT_MS,
  BYTE_LIMIT,
  pickTargetChains,
  formatResidueIdentity,
  describeCoordinates,
} from "../src/lib/structure-viewer-rules.ts";

test("only provider coordinate endpoints are trusted", () => {
  assert.equal(allowedCoordinateUrl("https://files.rcsb.org/download/6XRE.cif"), true);
  assert.equal(allowedCoordinateUrl("https://files.rcsb.org/download/6XRE-assembly1.cif"), true);
  assert.equal(allowedCoordinateUrl("https://alphafold.ebi.ac.uk/files/AF-P04637-F1-model_v6.cif"), true);
  assert.equal(allowedCoordinateUrl("https://files.rcsb.org/download/../../etc"), false);
  assert.equal(allowedCoordinateUrl("https://evil.example/6XRE.cif"), false);
  assert.equal(allowedCoordinateUrl("http://files.rcsb.org/download/6XRE.cif"), false);
  assert.equal(allowedCoordinateUrl("https://files.rcsb.org:8443/download/6XRE.cif"), false);
  assert.equal(allowedCoordinateUrl("https://user:pw@files.rcsb.org/download/6XRE.cif"), false);
  assert.equal(allowedCoordinateUrl("https://files.rcsb.org/download/6XRE.pdb"), false);
  assert.equal(allowedCoordinateUrl("https://files.rcsb.org/download/6XRE.cif?x=1"), false);
});

test("limits are the approved initial values", () => {
  assert.equal(FETCH_TIMEOUT_MS, 30_000);
  assert.equal(BYTE_LIMIT, 25 * 1024 * 1024);
  assert.equal(ATOM_LIMIT, 250_000);
});

test("target chains are matched as author polymer chains only", () => {
  const components = [
    { labelAsymId: "A", authAsymId: "M", polymer: true, atoms: 100 },
    { labelAsymId: "B", authAsymId: "N", polymer: true, atoms: 100 },
    { labelAsymId: "C", authAsymId: "M", polymer: false, atoms: 5 },
  ];
  assert.deepEqual(pickTargetChains(components, [{ chain: "M" }]), ["A"]);
  assert.deepEqual(pickTargetChains(components, [{ chain: "M" }, { chain: "N" }]), ["A", "B"]);
  assert.deepEqual(pickTargetChains(components, [{ chain: "Z" }]), []);
  assert.deepEqual(pickTargetChains(components, []), []);
});

test("residue identity keeps author and label namespaces distinct", () => {
  assert.equal(
    formatResidueIdentity({
      comp: "ARG", authChain: "M", labelChain: "A", authSeq: 175, labelSeq: 175,
      insCode: "", model: 1, copy: null,
    }),
    "ARG M 175 (label chain A, label seq 175, model 1)",
  );
  assert.equal(
    formatResidueIdentity({
      comp: "HOH", authChain: "M", labelChain: "A", authSeq: 175, labelSeq: 175,
      insCode: "A", model: 2, copy: "1_555",
    }),
    "HOH M 175A (label chain A, label seq 175, model 2, copy 1_555)",
  );
  // Namespaces can differ; never collapse them into one label.
  const differing = formatResidueIdentity({
    comp: "GLY", authChain: "X", labelChain: "B", authSeq: 7, labelSeq: 3,
    insCode: "", model: 1, copy: null,
  });
  assert.ok(differing.includes("X") && differing.includes("label chain B") && differing.includes("label seq 3"));
});

test("coordinate provenance is labeled honestly", () => {
  assert.equal(describeCoordinates("experimental", null), "Deposited coordinates (asymmetric unit)");
  assert.equal(describeCoordinates("experimental", "1"), "Biological assembly 1");
  assert.equal(describeCoordinates("predicted", null), "Predicted model (AlphaFold)");
  assert.equal(describeCoordinates("predicted", "1"), "Predicted model (AlphaFold)");
});
