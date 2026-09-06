const encoder = new TextEncoder();
const hex = (bytes: ArrayBuffer) =>
	[...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
async function key(secret: string, usage: KeyUsage[]) {
	if (secret.length < 32) throw new Error('Guest proxy secret is not configured.');
	return crypto.subtle.importKey(
		'raw',
		encoder.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		usage
	);
}
export async function signGuestRequest(secret: string, ip: string, now = Date.now()) {
	const signingKey = await key(secret, ['sign']);
	const clientKey = hex(await crypto.subtle.sign('HMAC', signingKey, encoder.encode(`ip:${ip}`)));
	const timestamp = String(now);
	const proof = hex(
		await crypto.subtle.sign('HMAC', signingKey, encoder.encode(`signup:${timestamp}:${clientKey}`))
	);
	return { clientKey, timestamp, proof };
}
export async function verifyGuestRequest(secret: string, headers: Headers, now = Date.now()) {
	const clientKey = headers.get('x-fourfold-client') ?? '';
	const timestamp = headers.get('x-fourfold-time') ?? '';
	const proof = headers.get('x-fourfold-proof') ?? '';
	if (
		!/^[a-f0-9]{64}$/.test(clientKey) ||
		!/^[a-f0-9]{64}$/.test(proof) ||
		!/^\d{13}$/.test(timestamp)
	)
		return null;
	if (now - Number(timestamp) > 60000 || Number(timestamp) - now > 5000) return null;
	const signature = Uint8Array.from(proof.match(/../g)!, (byte) => parseInt(byte, 16));
	const valid = await crypto.subtle.verify(
		'HMAC',
		await key(secret, ['verify']),
		signature,
		encoder.encode(`signup:${timestamp}:${clientKey}`)
	);
	return valid ? clientKey : null;
}
