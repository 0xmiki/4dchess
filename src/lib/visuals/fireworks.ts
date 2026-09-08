/** Particle artwork from the approved studio video, adapted to a live viewport. */
type RGB = readonly [number, number, number];
type Spark = {
	vx: number;
	vy: number;
	life: number;
	size: number;
	phase: number;
	drag: number;
	gravity: number;
	depth: number;
	glitter: boolean;
};
type Shell = { at: number; x: number; y: number; color: RGB; sparks: Spark[]; willow: boolean };
let seed = 0x4dfe2026;
const random = () => {
	seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
	return seed / 4294967296;
};
const GOLD: RGB = [255, 199, 108],
	PEARL: RGB = [225, 240, 255],
	ICE: RGB = [127, 211, 255],
	LILAC: RGB = [205, 159, 255];
const cues: [number, number, number, RGB, boolean][] = [
	[0.2, 410, 325, GOLD, true],
	[0.68, 1490, 300, ICE, false],
	[1.27, 970, 190, PEARL, true],
	[1.91, 465, 555, GOLD, true],
	[2.43, 1460, 565, LILAC, false],
	[2.94, 840, 230, GOLD, true],
	[3.4, 1230, 265, PEARL, false],
	[3.82, 380, 380, GOLD, true],
	[4.18, 1550, 330, ICE, false]
];
const shells: Shell[] = cues.map(([at, x, y, color, willow]) => ({
	at,
	x,
	y,
	color,
	willow,
	sparks: Array.from({ length: willow ? 220 : 180 }, (_, i) => {
		// A spherical shell produces overlapping front/back embers, not a flat ring.
		const z = random() * 2 - 1,
			azimuth = i * 2.3999632297 + random() * 0.2;
		const radial = Math.sqrt(1 - z * z),
			speed = (willow ? 295 : 330) * (0.78 + random() * 0.3);
		return {
			vx: Math.cos(azimuth) * radial * speed,
			vy: Math.sin(azimuth) * radial * speed,
			depth: 1 + z * 0.24,
			life: (willow ? 2.25 : 1.65) + random() * 0.7,
			size: 0.6 + random() * 0.8,
			phase: random() * Math.PI * 2,
			drag: willow ? 0.62 : 0.92,
			gravity: willow ? 68 : 86,
			glitter: random() < 0.35
		};
	})
}));
const point = (s: Spark, age: number) => {
	const distance = (1 - Math.exp(-s.drag * age)) / s.drag;
	return { x: s.vx * distance, y: s.vy * distance + s.gravity * age * age };
};
const sprites = new Map<string, HTMLCanvasElement>();
function sprite(color: RGB) {
	const key = color.join(',');
	if (sprites.has(key)) return sprites.get(key)!;
	const c = document.createElement('canvas');
	c.width = c.height = 48;
	const ctx = c.getContext('2d')!;
	const g = ctx.createRadialGradient(24, 24, 0, 24, 24, 24);
	g.addColorStop(0, 'rgba(255,255,245,1)');
	g.addColorStop(0.08, 'rgba(255,255,240,.95)');
	g.addColorStop(0.23, `rgba(${key},.5)`);
	g.addColorStop(0.55, `rgba(${key},.10)`);
	g.addColorStop(1, `rgba(${key},0)`);
	ctx.fillStyle = g;
	ctx.fillRect(0, 0, 48, 48);
	sprites.set(key, c);
	return c;
}
export const FIREWORKS_DURATION = 7.3;
export function drawFireworks(
	canvas: HTMLCanvasElement,
	time: number,
	width: number,
	height: number,
	exclusion?: { x: number; y: number; width: number; height: number }
) {
	const ctx = canvas.getContext('2d')!;
	ctx.setTransform(1, 0, 0, 1, 0, 0);
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
	const compact = width < 768;
	const scale = Math.max(0.55, Math.min(1.3, width / 1920, height / 1080));
	if (time < 0) return 0;
	ctx.globalCompositeOperation = 'lighter';
	ctx.lineCap = 'round';
	let count = 0;
	for (const shell of shells) {
		ctx.save();
		ctx.translate((shell.x / 1920) * width, (shell.y / 1080) * height);
		ctx.scale(scale, scale);
		ctx.translate(-shell.x, -shell.y);
		const age = time - shell.at,
			rgb = shell.color.join(','),
			glow = sprite(shell.color);
		if (age >= -0.48 && age < 0) {
			const u = (age + 0.48) / 0.48,
				headY = 1060 + (shell.y - 1060) * (1 - Math.pow(1 - u, 1.65));
			// A rising comet with a short, fading plume.
			for (let j = 0; j < 18; j++) {
				const yy = headY + j * 4.5,
					xx = shell.x + Math.sin(j * 1.8 + shell.at) * 1.8;
				ctx.globalAlpha = (1 - j / 18) * 0.6;
				ctx.drawImage(glow, xx - 4, yy - 4, 8, 8);
			}
			ctx.globalAlpha = 0.95;
			ctx.drawImage(glow, shell.x - 9, headY - 9, 18, 18);
			count++;
			ctx.restore();
			continue;
		}
		if (age < 0 || age > 3.05) {
			ctx.restore();
			continue;
		}
		if (age < 0.2) {
			const size = 90 * (1 - age / 0.2) + 20;
			ctx.globalAlpha = 0.6 * (1 - age / 0.2);
			ctx.drawImage(glow, shell.x - size / 2, shell.y - size / 2, size, size);
		}
		for (let index = 0; index < shell.sparks.length; index += compact ? 2 : 1) {
			const s = shell.sparks[index];
			if (age > s.life) continue;
			const fade = Math.pow(Math.max(0, 1 - age / s.life), 0.55);
			const twinkle = age < 0.8 ? 1 : 0.72 + 0.28 * Math.pow(Math.sin(age * 24 + s.phase), 2);
			const tail = Math.min(age, shell.willow ? 0.4 : 0.26);
			// Draw older, cooler embers first; each strand tapers into its hot head.
			const segments = compact ? 6 : 9;
			for (let j = 0; j < segments; j++) {
				const u = j / segments,
					v = (j + 1) / segments;
				const a = point(s, age - tail * (1 - u)),
					b = point(s, age - tail * (1 - v));
				const strength = Math.pow(v, 1.8) * fade * twinkle * s.depth;
				ctx.globalAlpha = Math.min(0.88, strength * 0.74);
				ctx.strokeStyle = `rgb(${rgb})`;
				ctx.lineWidth = s.size * (0.22 + 0.72 * v);
				ctx.beginPath();
				ctx.moveTo(shell.x + a.x, shell.y + a.y);
				ctx.lineTo(shell.x + b.x, shell.y + b.y);
				ctx.stroke();
			}
			const head = point(s, age),
				size = (7 + s.size * 4) * s.depth;
			ctx.globalAlpha = Math.min(1, fade * twinkle * 0.85);
			ctx.drawImage(glow, shell.x + head.x - size / 2, shell.y + head.y - size / 2, size, size);
			ctx.globalAlpha = fade * 0.9;
			ctx.fillStyle = 'rgb(255,246,218)';
			ctx.beginPath();
			ctx.arc(shell.x + head.x, shell.y + head.y, 0.55 * s.depth, 0, Math.PI * 2);
			ctx.fill();
			// Tiny detached gold fragments fall behind selected long-lived stars.
			if (s.glitter && age > 0.45) {
				for (let k = 0; k < 3; k++) {
					const lag = 0.12 + k * 0.1,
						p = point(s, Math.max(0, age - lag));
					const flicker = Math.max(0, Math.sin(age * (31 + k * 7) + s.phase + k));
					ctx.globalAlpha = fade * flicker * 0.7;
					ctx.drawImage(glow, shell.x + p.x - 3, shell.y + p.y + lag * age * 65 - 3, 6, 6);
				}
			}
			count++;
		}
		ctx.restore();
	}
	ctx.globalAlpha = 1;
	// The top-layer canvas paints around the native dialog, never over its controls.
	if (exclusion) {
		ctx.globalCompositeOperation = 'destination-out';
		ctx.fillStyle = '#000';
		ctx.beginPath();
		ctx.roundRect(exclusion.x - 1, exclusion.y - 1, exclusion.width + 2, exclusion.height + 2, 20);
		ctx.fill();
	}
	ctx.globalCompositeOperation = 'source-over';
	return count;
}
