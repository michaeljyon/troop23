// Netlify Function: every /api/* request lands here. Data lives in Netlify
// Blobs (no database to set up), in a store named after troop.id.
import { getStore } from '@netlify/blobs';
import { handle, isDemoRequest } from '../lib/core.mjs';
import troop from '../../troop/troop.js';

export default async (req, context) => {
  const demo = await isDemoRequest(req);   // the demo troop has its own store
  return handle(req, {
    waitUntil: context?.waitUntil ? p => context.waitUntil(p) : null,
    store: getStore({ name: `basecamp-${troop.id}${demo ? '-demo' : ''}`, consistency: 'strong' }),
    troopCode: demo ? 'demo' : process.env.TROOP_CODE || '',
    leaderPasscode: process.env.LEADER_PASSCODE || '',
    demo,
  });
};

export const config = { path: '/api/*' };
