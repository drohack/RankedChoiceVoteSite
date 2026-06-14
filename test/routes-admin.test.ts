import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import sharp from 'sharp';
import { __setTestDbToMemory, __closeDb } from '@/lib/db';
import { getVotingWithItems, getOpenRound } from '@/lib/queries';
import { POST as createVotingRoute } from '@/app/api/admin/votings/route';
import {
  PUT as updateVotingRoute,
  DELETE as deleteVotingRoute,
} from '@/app/api/admin/votings/[id]/route';
import { POST as startRoute } from '@/app/api/admin/votings/[id]/start/route';
import { POST as stopRoute } from '@/app/api/admin/votings/[id]/stop/route';
import { GET as statusRoute } from '@/app/api/admin/status/route';
import { POST as uploadRoute } from '@/app/api/admin/upload/route';

beforeEach(() => {
  __setTestDbToMemory();
});
afterAll(() => {
  __closeDb();
});

const params = (id: number | string) => ({
  params: Promise.resolve({ id: String(id) }),
});
function jsonReq(body: unknown) {
  return new Request('http://localhost/x', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}
const emptyPost = () =>
  new Request('http://localhost/x', { method: 'POST' });

async function createVoting(items = 2) {
  const arr = Array.from({ length: items }, (_, i) => ({ name: `I${i}` }));
  const res = await createVotingRoute(jsonReq({ title: 'V', items: arr }));
  return (await res.json()).voting.id as number;
}

describe('voting CRUD routes', () => {
  it('creates a voting (201) and rejects invalid input (400)', async () => {
    const ok = await createVotingRoute(
      jsonReq({ title: 'Colors', masterImage: null, items: [{ name: 'A' }, { name: 'B' }] })
    );
    expect(ok.status).toBe(201);
    const body = await ok.json();
    expect(body.voting.title).toBe('Colors');
    expect(body.voting.items).toHaveLength(2);

    const bad = await createVotingRoute(jsonReq({ title: '', items: [] }));
    expect(bad.status).toBe(400);
  });

  it('updates a voting (PUT) and 404s for an unknown id', async () => {
    const id = await createVoting();
    const res = await updateVotingRoute(
      jsonReq({ title: 'Renamed', items: [{ name: 'A' }, { name: 'B' }, { name: 'C' }] }),
      params(id)
    );
    expect(res.status).toBe(200);
    expect(getVotingWithItems(id)?.title).toBe('Renamed');
    expect(getVotingWithItems(id)?.items).toHaveLength(3);

    const missing = await updateVotingRoute(
      jsonReq({ title: 'Y', items: [{ name: 'A' }, { name: 'B' }] }),
      params(99999)
    );
    expect(missing.status).toBe(404);
  });

  it('deletes a voting', async () => {
    const id = await createVoting();
    const res = await deleteVotingRoute(
      new Request('http://localhost/x', { method: 'DELETE' }),
      params(id)
    );
    expect(res.status).toBe(200);
    expect(getVotingWithItems(id)).toBeUndefined();
  });
});

describe('round routes + status', () => {
  it('start opens a round, status reflects it, stop closes it', async () => {
    const id = await createVoting();
    expect((await startRoute(emptyPost(), params(id))).status).toBe(200);
    expect(getOpenRound()?.voting_id).toBe(id);

    const status = await (await statusRoute()).json();
    expect(status.open.votingId).toBe(id);
    expect(status.open.ballotCount).toBe(0);

    expect((await stopRoute(emptyPost(), params(id))).status).toBe(200);
    expect(getOpenRound()).toBeUndefined();
    expect((await (await statusRoute()).json()).open).toBeNull();
  });

  it('refuses to start a voting with fewer than two items (400)', async () => {
    const id = await createVoting(1);
    const res = await startRoute(emptyPost(), params(id));
    expect(res.status).toBe(400);
  });
});

describe('upload route', () => {
  it('accepts an image and returns a /uploads url', async () => {
    const buf = await sharp({
      create: { width: 32, height: 32, channels: 3, background: { r: 1, g: 2, b: 3 } },
    })
      .png()
      .toBuffer();
    const fd = new FormData();
    fd.append('file', new File([buf], 'a.png', { type: 'image/png' }));
    const res = await uploadRoute(
      new Request('http://localhost/x', { method: 'POST', body: fd })
    );
    expect(res.status).toBe(200);
    expect((await res.json()).url).toMatch(/^\/uploads\/.+\.webp$/);
  });

  it('rejects a non-image (400)', async () => {
    const fd = new FormData();
    fd.append('file', new File([Buffer.from('x')], 'a.txt', { type: 'text/plain' }));
    const res = await uploadRoute(
      new Request('http://localhost/x', { method: 'POST', body: fd })
    );
    expect(res.status).toBe(400);
  });
});
