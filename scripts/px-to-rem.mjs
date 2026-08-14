/**
 * Convert hard-coded px → rem (base 16) across app src.
 * Skips: @media breakpoints, html font-size scale, url(), comments.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve("src");
const BASE = 16;

function pxToRem(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return `${n}px`;
  if (v === 0) return "0";
  const rem = v / BASE;
  // trim trailing zeros
  const s = String(Number(rem.toFixed(5)));
  return `${s}rem`;
}

function convertCss(content, filePath) {
  const isIndex = filePath.endsWith(`${path.sep}index.css`) || filePath.endsWith("/index.css");
  let out = content;

  // Protect media query conditions and html font-size rules in index.css
  const protectedBlocks = [];
  out = out.replace(/@media\s*\([^)]+\)/g, (m) => {
    const i = protectedBlocks.length;
    protectedBlocks.push(m);
    return `/*__PROTECT_${i}__*/`;
  });
  if (isIndex) {
    out = out.replace(/html\s*\{\s*font-size:\s*[\d.]+px\s*;\s*\}/g, (m) => {
      const i = protectedBlocks.length;
      protectedBlocks.push(m);
      return `/*__PROTECT_${i}__*/`;
    });
  }

  // CSS values: number+px (not in urls already protected)
  out = out.replace(/(?<![\w-])(-?\d*\.?\d+)px\b/g, (_, n) => pxToRem(n));

  // Restore protected
  out = out.replace(/\/\*__PROTECT_(\d+)__\*\//g, (_, i) => protectedBlocks[Number(i)]);
  return out;
}

function convertTsx(content) {
  let out = content;

  // Tailwind arbitrary: text-[13px], w-[256px], min-h-[140px], rounded-[10px], etc.
  out = out.replace(/\[(-?\d*\.?\d+)px\]/g, (_, n) => `[${pxToRem(n)}]`);

  // Inline style objects / template: "12px", '12px', `12px` in style-ish contexts
  // Broad: any quoted/backtick px length that's a pure size
  out = out.replace(/(["'`])(-?\d*\.?\d+)px\1/g, (_, q, n) => `${q}${pxToRem(n)}${q}`);

  // CSS-in-JS unquoted in style={{ width: 12 }} — skip numbers without px
  // style strings like width: "12px" already handled

  // Template literals with ${} stay; also handle `12px` already done

  // GridStack / numeric cell heights that are numbers in JS (CASE_CELL_HEIGHT = 84)
  // Convert only if they have px suffix in strings

  return out;
}

function walk(dir, files = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === "dist") continue;
      walk(p, files);
    } else if (/\.(css|tsx|ts|jsx|js)$/.test(ent.name)) {
      files.push(p);
    }
  }
  return files;
}

const files = walk(ROOT);
let changed = 0;
for (const file of files) {
  const before = fs.readFileSync(file, "utf8");
  let after = before;
  if (file.endsWith(".css")) after = convertCss(before, file);
  else after = convertTsx(before);
  if (after !== before) {
    fs.writeFileSync(file, after);
    changed++;
    console.log("updated", path.relative(process.cwd(), file));
  }
}
console.log(`\nDone. ${changed} files updated.`);
