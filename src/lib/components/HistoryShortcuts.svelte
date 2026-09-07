<script lang="ts">
	import { onMount, getContext } from 'svelte';
	import { historyMotionKey, type HistoryMotion } from '$lib/history-motion';
	const motion = getContext<HistoryMotion | undefined>(historyMotionKey);
	let { previous, next }: { previous: () => void; next: () => void } = $props();
	onMount(() => {
		function navigate(event: KeyboardEvent) {
			if (
				event.defaultPrevented ||
				event.altKey ||
				event.ctrlKey ||
				event.metaKey ||
				event.shiftKey ||
				(event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')
			)
				return;
			const target = event.target;
			if (
				document.querySelector('dialog[open], [popover]:popover-open') ||
				(target instanceof Element &&
					target.closest(
						'input, textarea, select, [contenteditable="true"], [role="combobox"], [role="listbox"], [role="application"]'
					))
			)
				return;
			event.preventDefault();
			event.stopPropagation();
			motion?.record(performance.now(), event.repeat);
			if (event.key === 'ArrowLeft') previous();
			else next();
		}
		window.addEventListener('keydown', navigate, true);
		const pointer = (event: PointerEvent) => {
			if (
				event.target instanceof Element &&
				event.target.closest(
					'.history-controls button, .score-sheet button, .variation-history button, .analysis-status button'
				)
			)
				motion?.record(performance.now(), false);
		};
		window.addEventListener('pointerdown', pointer, true);
		return () => {
			window.removeEventListener('keydown', navigate, true);
			window.removeEventListener('pointerdown', pointer, true);
		};
	});
</script>
