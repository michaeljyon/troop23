// Meeting notes, with photos and files.
//   PLC notes:       read by scouts and leaders; written by leaders and Patrol Leaders' Council scouts.
//   Committee notes: leaders only (read and write). Minutes are Draft until the committee approves
//                    them; approved minutes are locked until a leader marks them as a draft again.
import { ATT_MAX, ATT_TYPES, BAD_EXT } from './people.mjs';

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const err = (message, status = 400) => json({ error: message }, status);
const clean = (s, n = 200) => String(s ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ').trim().slice(0, n);
const rid = () => Math.random().toString(36).slice(2, 10);
const BOOKS = { plc: 'PLC', committee: 'Committee' };
const PLC_RX = /senior patrol|\bspl\b|\baspl\b|patrol leader|troop guide|scribe/i;

export function notesAccess(me, isLeader) {
  const leader = !!(isLeader || me?.leader);
  const scout = me?.role === 'scout';
  return {
    plc: { read: leader || scout, write: leader || (scout && PLC_RX.test((me.positions || []).join(', '))) },
    committee: { read: leader, write: leader },
  };
}

export async function notesRoutes(store, rest, req, body, now, ctx) {
  const { me } = ctx;
  const leader = !!(ctx.isLeader || me?.leader);
  const acc = notesAccess(me, ctx.isLeader);
  const [book, id, sub, fid] = rest;

  if (!book && req.method === 'GET') return json({ access: acc });
  if (!BOOKS[book]) return err('Not found', 404);
  const a = acc[book];
  if (!a.read) return err(book === 'committee' ? 'Committee notes are for leaders.' : 'Sign in with your personal code to see PLC notes.', me ? 403 : 401);

  const key = nid => `notes/${book}/n/${nid}`;
  const load = async nid => (/^n-[a-z0-9]+$/.test(nid || '') ? store.get(key(nid), { type: 'json' }) : null);
  const canEdit = n => a.write && (leader || n.by === me?.id);

  if (!id && req.method === 'GET') {
    const { blobs } = await store.list({ prefix: `notes/${book}/n/` });
    const list = (await Promise.all(blobs.map(b => store.get(b.key, { type: 'json' })))).filter(Boolean)
      .map(n => ({ id: n.id, title: n.title, date: n.date, status: n.status, byName: n.byName, excerpt: n.body.replace(/[*_~`#>[\]]/g, '').replace(/\s+/g, ' ').slice(0, 160), photos: n.files.filter(f => f.kind === 'image').length, files: n.files.filter(f => f.kind !== 'image').length, approvedAt: n.approvedAt || 0 }))
      .sort((x, y) => y.date.localeCompare(x.date));
    return json({ book, notes: list, canWrite: a.write });
  }

  // create or edit
  if ((!id && req.method === 'POST') || (id && !sub && req.method === 'PUT')) {
    if (!a.write) return err(book === 'committee' ? 'Only leaders can write committee notes.' : 'Only the Patrol Leaders\' Council and leaders can write PLC notes.', 403);
    const prev = id ? await load(id) : null;
    if (id && !prev) return err('Notes not found.', 404);
    if (prev && !canEdit(prev)) return err('Only the person who wrote these notes, or a leader, can change them.', 403);
    if (prev?.status === 'approved') return err('These minutes are approved and locked. Mark them as a draft first to change them.', 409);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(body.date || '') ? body.date : new Date(now).toISOString().slice(0, 10);
    const n = {
      ...(prev || { id: `n-${rid()}`, book, files: [], status: book === 'committee' ? 'draft' : 'final', by: me?.id || 'leader', byName: me?.name || 'Leader', created: now }),
      title: clean(body.title, 120) || `${BOOKS[book]} meeting`, date, attendees: clean(body.attendees, 600), body: clean(body.body, 30000),
      updated: now, updatedBy: me?.name || 'Leader',
    };
    await store.setJSON(key(n.id), n);
    return json({ ok: true, note: n });
  }

  const n = await load(id);
  if (!n) return err('Notes not found.', 404);

  if (!sub && req.method === 'GET') return json({ note: n, canEdit: canEdit(n), canApprove: book === 'committee' && leader });

  if (sub === 'approve' && req.method === 'POST') {
    if (book !== 'committee' || !leader) return err('Only leaders approve committee minutes.', 403);
    if (body.approved === false) { n.status = 'draft'; n.approvedAt = 0; n.approvedBy = ''; }
    else { n.status = 'approved'; n.approvedAt = now; n.approvedBy = me?.name || 'Leader'; n.approvedOn = /^\d{4}-\d{2}-\d{2}$/.test(body.on || '') ? body.on : new Date(now).toISOString().slice(0, 10); }
    await store.setJSON(key(n.id), n);
    return json({ ok: true, note: n });
  }

  if (!sub && req.method === 'DELETE') {
    if (!canEdit(n)) return err('Only the person who wrote these notes, or a leader, can delete them.', 403);
    if (n.status === 'approved' && !leader) return err('Approved minutes can\'t be deleted.', 409);
    const { blobs } = await store.list({ prefix: `notes/${book}/f/${n.id}/` });
    await Promise.all(blobs.map(b => store.delete(b.key)));
    await store.delete(key(n.id));
    return json({ ok: true });
  }

  // photos and files
  if (sub === 'files' && !fid && req.method === 'POST') {
    if (!canEdit(n)) return err('Only the person who wrote these notes, or a leader, can add files.', 403);
    if (n.status === 'approved') return err('These minutes are approved and locked. Mark them as a draft first to add files.', 409);
    if (n.files.length >= 30) return err('That\'s the most files one set of notes can hold (30).');
    const name = clean(body.name, 120).replace(/[\\/:*?"<>|]+/g, '_') || 'file';
    const type = clean(body.type, 100).toLowerCase();
    if (!ATT_TYPES.test(type) || BAD_EXT.test(name)) return err('That kind of file can\'t be added here. Photos, PDFs, Word, Excel, PowerPoint and text files are OK.');
    const m = /^data:[^;,]*;base64,(.+)$/.exec(String(body.data || ''));
    if (!m) return err('That file didn\'t come through. Try again.');
    const bytes = Uint8Array.from(atob(m[1]), c => c.charCodeAt(0));
    if (bytes.byteLength > ATT_MAX) return err(`${name} is too big. Files can be up to ${Math.round(ATT_MAX / 1048576)} MB.`);
    const f = { id: `${now.toString(36)}${rid().slice(-6)}`, name, type, size: bytes.byteLength, kind: type.startsWith('image/') ? 'image' : 'file', w: Number(body.w) || 0, h: Number(body.h) || 0, by: me?.name || 'Leader', at: now };
    await store.set(`notes/${book}/f/${n.id}/${f.id}`, bytes, { metadata: f });
    n.files.push(f); n.updated = now;
    await store.setJSON(key(n.id), n);
    return json({ ok: true, file: f, note: n });
  }
  if (sub === 'files' && fid && req.method === 'GET') {
    const r = await store.getWithMetadata(`notes/${book}/f/${n.id}/${clean(fid, 40)}`, { type: 'arrayBuffer' });
    if (!r) return new Response('Not found', { status: 404 });
    const mt = r.metadata || {};
    const inline = String(mt.type).startsWith('image/') && new URL(req.url).searchParams.get('dl') !== '1';
    return new Response(r.data, { headers: {
      'content-type': mt.type || 'application/octet-stream', 'x-content-type-options': 'nosniff', 'cache-control': 'private, max-age=604800',
      'content-disposition': `${inline ? 'inline' : 'attachment'}; filename="${String(mt.name || 'file').replace(/[^\w.\- ]+/g, '_')}"`,
      'content-security-policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    } });
  }
  if (sub === 'files' && fid && req.method === 'DELETE') {
    if (!canEdit(n)) return err('Only the person who wrote these notes, or a leader, can remove files.', 403);
    if (n.status === 'approved') return err('These minutes are approved and locked.', 409);
    await store.delete(`notes/${book}/f/${n.id}/${clean(fid, 40)}`);
    n.files = n.files.filter(f => f.id !== fid); n.updated = now;
    await store.setJSON(key(n.id), n);
    return json({ ok: true, note: n });
  }
  return err('Not found', 404);
}
