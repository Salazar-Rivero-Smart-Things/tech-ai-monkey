// Merge two thin Mach-O executables into one universal (fat) binary.
// Used by scripts/build-dmg.sh; Bun can cross-compile but not lipo.
import fs from "node:fs";

const [armPath, x64Path, outPath] = process.argv.slice(2);
if (!armPath || !x64Path || !outPath) {
  console.error("usage: make-universal-macho.mjs <arm64> <x64_64> <out>");
  process.exit(1);
}

const MH_MAGIC_64 = 0xfeedfacf;
const FAT_MAGIC = 0xcafebabe;
const FAT_ALIGN = 14; // 16 KiB, what Apple's lipo uses for large binaries
const CPU_TYPE_X86_64 = 0x01000007;
const CPU_TYPE_ARM64 = 0x0100000c;

function readSlice(path) {
  const data = fs.readFileSync(path);
  if (data.readUInt32LE(0) !== MH_MAGIC_64) {
    throw new Error(`${path} is not a thin 64-bit Mach-O file`);
  }
  return {
    cputype: data.readUInt32LE(4),
    cpusubtype: data.readUInt32LE(8),
    data,
  };
}

const arm = readSlice(armPath);
const x64 = readSlice(x64Path);
if (arm.cputype !== CPU_TYPE_ARM64) throw new Error(`${armPath} is not arm64`);
if (x64.cputype !== CPU_TYPE_X86_64) throw new Error(`${x64Path} is not x86_64`);

const slices = [arm, x64];
const headerSize = 8 + slices.length * 20;
let offset = Math.ceil(headerSize / (1 << FAT_ALIGN)) * (1 << FAT_ALIGN);

const header = Buffer.alloc(offset);
header.writeUInt32BE(FAT_MAGIC, 0);
header.writeUInt32BE(slices.length, 4);
slices.forEach((slice, index) => {
  const entry = 8 + index * 20;
  header.writeUInt32BE(slice.cputype, entry);
  header.writeUInt32BE(slice.cpusubtype, entry + 4);
  header.writeUInt32BE(offset, entry + 8);
  header.writeUInt32BE(slice.data.length, entry + 12);
  header.writeUInt32BE(FAT_ALIGN, entry + 16);
  offset = Math.ceil((offset + slice.data.length) / (1 << FAT_ALIGN)) * (1 << FAT_ALIGN);
});

const out = Buffer.alloc(offset);
header.copy(out);
let writeAt = header.readUInt32BE(8 + 8);
for (const slice of slices) {
  slice.data.copy(out, writeAt);
  writeAt = Math.ceil((writeAt + slice.data.length) / (1 << FAT_ALIGN)) * (1 << FAT_ALIGN);
}
fs.writeFileSync(outPath, out, { mode: 0o755 });
console.log(`universal binary: ${outPath} (${(out.length / 1024 / 1024).toFixed(1)} MB)`);
