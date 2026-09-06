import { canReach, inCheck, simulateMove, isSquare } from './fourfold-v1';
import type { Board, Color } from './types';

/** Mirrors the prototype's threat inspection, including friendly defenders. */
export function analyzeThreats(
	position: Board,
	activeColor: Color,
	target: number,
	source: number | null = null
) {
	if (!isSquare(target) || (source !== null && !isSquare(source)))
		throw new RangeError('Invalid inspection square.');
	const moving = source === null ? null : position[source];
	const preview =
		!!moving &&
		source !== target &&
		position[target]?.t !== 'k' &&
		canReach(position, source!, target);
	const viewed = preview ? simulateMove(position, { from: source!, to: target }) : position;
	const legalMove = !preview || !inCheck(viewed, moving!.c);
	const color = (preview ? moving!.c : position[target]?.c) ?? moving?.c ?? activeColor;
	const probe = viewed.slice();
	if (!probe[target]) probe[target] = { t: 'p', c: color };
	const kingSquare = probe[target].t === 'k';
	const attackers: number[] = [];
	for (let from = 0; from < 64; from++) {
		const piece = probe[from];
		if (!piece || !canReach(probe, from, target, true)) continue;
		if (kingSquare || !inCheck(simulateMove(probe, { from, to: target }), piece.c))
			attackers.push(from);
	}
	return {
		target,
		color,
		preview,
		legalMove,
		from: preview ? source : null,
		position: viewed,
		attackers,
		moving,
		kingSquare
	};
}
export type ThreatInspection = ReturnType<typeof analyzeThreats>;
