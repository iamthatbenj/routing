import { error } from '@sveltejs/kit';
import { findTripByShareToken } from '$lib/server/trips';

export const load = async ({ params }) => {
  const trip = await findTripByShareToken(params.token);

  if (!trip) {
    throw error(404, 'Trip share link not found');
  }

  return { trip };
};
