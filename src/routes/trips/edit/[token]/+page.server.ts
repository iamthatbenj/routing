import { error } from '@sveltejs/kit';
import { findTripByEditToken } from '$lib/server/trips';

export const load = async ({ params }) => {
  const trip = await findTripByEditToken(params.token);

  if (!trip) {
    throw error(404, 'Trip edit link not found');
  }

  return {
    trip,
    editToken: params.token
  };
};
