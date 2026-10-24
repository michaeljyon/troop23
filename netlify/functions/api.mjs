// Netlify Function: every /api/* request lands here. Data lives in Netlify
// Blobs (no database to set up), in a store named after troop.id.
import { getStore } from '@netlify/blobs';
import { handle } from '../lib/core.mjs';
import troop from '../../troop/troop.js';

export default async (req) => handle(req, {
  store: getStore({ name: `basecamp-${troop.id}`, consistency: 'strong' }),
  troopCode: process.env.TROOP_CODE || '',
  leaderPasscode: process.env.LEADER_PASSCODE || '',
});

export const config = { path: '/api/*' };
