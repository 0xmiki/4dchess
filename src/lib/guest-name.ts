const adjectives = [
	'Quiet',
	'Velvet',
	'Silver',
	'Amber',
	'Clever',
	'Winter',
	'Gentle',
	'Noble',
	'Golden',
	'Copper',
	'Patient',
	'Lunar',
	'Swift',
	'Hidden',
	'Ivory',
	'Merry'
];
const animals = [
	'Falcon',
	'Fox',
	'Owl',
	'Heron',
	'Lynx',
	'Raven',
	'Otter',
	'Finch',
	'Wolf',
	'Crane',
	'Robin',
	'Swan',
	'Badger',
	'Hare',
	'Wren',
	'Kestrel'
];

/** Called once by anonymous sign-up; Better Auth persists the returned name. */
export function randomGuestName(): string {
	const values = crypto.getRandomValues(new Uint32Array(3));
	return `${adjectives[values[0] % adjectives.length]} ${animals[values[1] % animals.length]} ${1000 + (values[2] % 9000)}`;
}

/** Keep the original names for guests created before names were stored. */
export function guestName(id: string): string {
	let hash = 2166136261;
	for (const character of id) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
	return `${adjectives[hash % adjectives.length]} ${animals[(hash >>> 8) % animals.length]} ${100 + ((hash >>> 16) % 900)}`;
}
