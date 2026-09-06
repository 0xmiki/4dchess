export default {
	fetch(request) {
		const destination = new URL(request.url);
		destination.protocol = 'https:';
		destination.hostname = '4dchess.lol';
		destination.port = '';
		return Response.redirect(destination.href, 308);
	}
};
