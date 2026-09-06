import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const css = readFileSync(new URL('./design.css', import.meta.url), 'utf8');
const colors = Object.fromEntries(
	[...css.matchAll(/--([\w-]+):\s*(#[\da-f]{6});/g)].map((match) => [match[1], match[2]])
);
function luminance(hex: string) {
	const channels = hex
		.slice(1)
		.match(/../g)!
		.map((c) => parseInt(c, 16) / 255)
		.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
	return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
function contrast(a: string, b: string) {
	const x = luminance(colors[a]),
		y = luminance(colors[b]);
	return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
it.each([
	['text', 'page'],
	['text', 'surface'],
	['muted', 'page'],
	['muted', 'surface'],
	['on-accent', 'accent'],
	['accent', 'page'],
	['axis-w', 'surface'],
	['danger', 'surface']
])('%s on %s meets normal-text contrast', (foreground, background) => {
	expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
});
it.each([
	['line-strong', 'surface'],
	['grid', 'surface'],
	['threat-attack', 'threat-outline'],
	['threat-defend', 'threat-outline'],
	['threat-outline', 'board-light'],
	['threat-outline', 'board-dark'],
	['piece-black', 'board-dark'],
	['piece-white', 'board-dark'],
	['piece-white-outline', 'board-light'],
	['piece-black-detail', 'surface']
])('%s against %s remains distinguishable', (foreground, background) => {
	expect(contrast(foreground, background)).toBeGreaterThanOrEqual(3);
});
