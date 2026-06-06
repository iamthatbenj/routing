import { fail, redirect } from '@sveltejs/kit';
import { createTrip } from '$lib/server/trips';

export const actions = {
  createTrip: async ({ request }) => {
    const formData = await request.formData();
    const rawTitle = formData.get('title');
    const title = typeof rawTitle === 'string' && rawTitle.trim() ? rawTitle.trim() : 'Untitled Trip';

    let trip;

    try {
      trip = await createTrip(title);
    } catch {
      return fail(500, {
        message: 'Could not create the Trip. Check database configuration and migrations.'
      });
    }

    throw redirect(303, `/trips/edit/${trip.editToken}`);
  }
};
