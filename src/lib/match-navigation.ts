export type MatchNavigation = {
	previous: (() => void) | null;
	next: (() => void) | null;
	live: (() => void) | null;
	label: string;
};
export const matchNavigationKey = Symbol('match-navigation');
