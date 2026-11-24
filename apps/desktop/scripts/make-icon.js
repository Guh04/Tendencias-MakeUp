// Gera assets/icon.png e assets/icon.ico (quadrado rosa com anel dourado e brilho), sem dependencias.
const fs = require("fs");
const zlib = require("zlib");
const path = require("path");
const S = 256;
const gold = [209, 176, 107], white = [255, 255, 255];
function render(rose, deep) {
const px = Buffer.alloc(S * S * 4);
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
for (let y = 0; y < S; y++)
  for (let x = 0; x < S; x++) {
    const cx = x - S / 2 + 0.5, cy = y - S / 2 + 0.5;
    // quadrado arredondado
    const r = 52, half = S / 2 - 6;
    const dx = Math.max(Math.abs(cx) - (half - r), 0), dy = Math.max(Math.abs(cy) - (half - r), 0);
    const inside = Math.hypot(dx, dy) <= r;
    let c = null, a = 0;
    if (inside) {
      a = 255;
      c = mix(rose, deep, (y / S) * 0.9);
      const d = Math.hypot(cx, cy);
      if (d > 92 && d < 100) c = gold; // anel dourado
      // brilho de 4 pontas (astroide)
      const k = 62, v = Math.pow(Math.abs(cx) / k, 2 / 3) + Math.pow(Math.abs(cy) / k, 2 / 3);
      if (v < 1) c = white;
      const k2 = 22, ox = 58, oy = -58, v2 = Math.pow(Math.abs(cx - ox) / k2, 2 / 3) + Math.pow(Math.abs(cy - oy) / k2, 2 / 3);
      if (v2 < 1) c = gold;
    }
    const i = (y * S + x) * 4;
    if (c) { px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = a; }
  }
return px;
}
function encode(px) {
// PNG
const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc = (b) => { let c = -1; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const cr = Buffer.alloc(4); cr.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, cr]);
};
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4); ihdr[8] = 8; ihdr[9] = 6;
const raw = Buffer.alloc((S * 4 + 1) * S);
for (let y = 0; y < S; y++) { raw[y * (S * 4 + 1)] = 0; px.copy(raw, y * (S * 4 + 1) + 1, y * S * 4, (y + 1) * S * 4); }
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
// ICO com PNG embutido
const head = Buffer.alloc(22);
head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(1, 4);
head[6] = 0; head[7] = 0; head.writeUInt16LE(1, 10); head.writeUInt16LE(32, 12); head.writeUInt32LE(png.length, 14); head.writeUInt32LE(22, 18);
return { png, ico: Buffer.concat([head, png]) };
}

const out = path.join(__dirname, "..", "assets");
fs.mkdirSync(out, { recursive: true });
const variants = {
  pdv: [[155, 68, 88], [103, 47, 60]], // rosa
  admin: [[74, 62, 92], [38, 30, 52]], // ameixa escuro
};
for (const [name, [a, b]] of Object.entries(variants)) {
  const { png, ico } = encode(render(a, b));
  fs.writeFileSync(path.join(out, `icon-${name}.png`), png);
  fs.writeFileSync(path.join(out, `icon-${name}.ico`), ico);
}
console.log("icones gerados em", out);
