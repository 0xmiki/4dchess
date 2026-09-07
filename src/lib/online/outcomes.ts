export const CURRENT_LIFECYCLE_POLICY = 'online-v1' as const;
export type ResultSummary =
	{ reason: string; winner: 'white' | 'black' | null; detail?: string } | null | undefined;

export function isUnscoredResult(result: ResultSummary): boolean {
	if (!result) return true;
	if (result.reason === 'draw') return result.winner !== null;
	return (
		!['checkmate', 'resignation', 'timeout', 'abandonment'].includes(result.reason) ||
		!result.winner
	);
}
export function resultMarker(result: ResultSummary): '*' | '1-0' | '0-1' | '1/2-1/2' {
	if (isUnscoredResult(result)) return '*';
	return result?.winner === 'white' ? '1-0' : result?.winner === 'black' ? '0-1' : '1/2-1/2';
}
