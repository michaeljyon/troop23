// A folder-backed stand-in for a Netlify Blobs store, used by `npm run dev`
// so every feature (leaderboard, photos, surveys, staff tools) works locally
// without the Netlify CLI. Data goes to .data/<store>/ and survives restarts.
import fs from 'node:fs';
import path from 'node:path';

export function fileStore(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const f = key => { fs.mkdirSync(dir, { recursive: true }); return path.join(dir, encodeURIComponent(key)); };
  const metaF = key => f(key) + '.__meta';
  return {
    async get(key, { type } = {}) {
      if (!fs.existsSync(f(key))) return null;
      const buf = fs.readFileSync(f(key));
      if (type === 'json') return JSON.parse(buf.toString('utf8'));
      if (type === 'arrayBuffer') return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
      return buf.toString('utf8');
    },
    async getWithMetadata(key, opts) {
      const data = await this.get(key, opts);
      if (data == null) return null;
      const metadata = fs.existsSync(metaF(key)) ? JSON.parse(fs.readFileSync(metaF(key), 'utf8')) : {};
      return { data, metadata };
    },
    async set(key, data, { metadata } = {}) {
      fs.writeFileSync(f(key), typeof data === 'string' ? data : Buffer.from(data));
      if (metadata) fs.writeFileSync(metaF(key), JSON.stringify(metadata));
    },
    async setJSON(key, obj) { fs.writeFileSync(f(key), JSON.stringify(obj)); },
    async delete(key) { for (const p of [f(key), metaF(key)]) if (fs.existsSync(p)) fs.unlinkSync(p); },
    async list({ prefix = '' } = {}) {
      if (!fs.existsSync(dir)) return { blobs: [] };
      const blobs = fs.readdirSync(dir).filter(n => !n.endsWith('.__meta')).map(decodeURIComponent)
        .filter(k => k.startsWith(prefix)).sort().map(key => ({ key }));
      return { blobs };
    },
  };
}
