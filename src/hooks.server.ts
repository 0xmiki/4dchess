import type { HandleServerError } from '@sveltejs/kit';

export const handleError: HandleServerError = ({ event, status }) => {
	const reference = crypto.randomUUID();
	console.error(
		JSON.stringify({ event: 'request_failure', reference, route: event.route.id, status })
	);
	return { message: `The request could not be completed. Reference: ${reference}` };
};
