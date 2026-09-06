import { build } from "esbuild";
import { exec as pkgExec } from "@yao-pkg/pkg";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync, existsSync, statSync, readFileSync, writeFileSync } from "node:fs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const distDir = join(root, "packaging", "dist");
const bundle = join(distDir, "helper.cjs");

const target = process.argv.includes("--linux")
  ? "node22-linux-x64"
  : process.argv.includes("--mac")
    ? "node22-macos-x64"
    : "node22-win-x64";
const exeName = target.includes("win") ? "cinebyRPC-helper.exe" : "cinebyRPC-helper";
const exePath = join(distDir, exeName);

rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });

console.log("esbuild: bundling app/src/index.js");
await build({
  entryPoints: [join(root, "app", "src", "index.js")],
  bundle: true,
  platform: "node",
  target: "node18",
  format: "cjs",
  outfile: bundle,
  external: ["bufferutil", "utf-8-validate"],
  legalComments: "none",
});
console.log(`  ${bundle}  (${(statSync(bundle).size / 1024).toFixed(0)} KB)`);

console.log(`pkg: building ${exeName} for ${target}`);
await pkgExec([bundle, "--targets", target, "--output", exePath, "--compress", "GZip"]);

if (!existsSync(exePath)) {
  console.error("pkg did not produce an executable");
  process.exit(1);
}
console.log(`  ${exePath}  (${(statSync(exePath).size / 1024 / 1024).toFixed(1)} MB)`);

if (target.includes("win")) {
  console.log("patching PE subsystem to GUI (no console window)");
  const buf = readFileSync(exePath);
  const peOff = buf.readUInt32LE(0x3c);
  if (buf.toString("ascii", peOff, peOff + 4) !== "PE\0\0") {
    console.warn("  not a PE file? skipping");
  } else {
    const subsystemOff = peOff + 0x5c;
    if (buf.readUInt16LE(subsystemOff) === 3) {
      buf.writeUInt16LE(2, subsystemOff);
      writeFileSync(exePath, buf);
      console.log("  done");
    } else {
      console.log("  subsystem already non-console, leaving as-is");
    }
  }
}

console.log("\nDone. Next: run packaging/install.ps1");
