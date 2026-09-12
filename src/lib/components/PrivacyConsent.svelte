<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import Button from './Button.svelte';
	import { consentKey, readConsent, saveConsent } from '$lib/privacy';
	let storageFailed = $state(false);
	let open = $state(false);
	let settingsTrigger: HTMLElement | null = null;
	onMount(() => {
		const check = () => {
			try {
				if (!readConsent(localStorage.getItem(consentKey))) open = true;
			} catch {
				open = true;
			}
		};
		check();
		const storage = (event: StorageEvent) => {
			if (event.key === consentKey || event.key === null) check();
		};
		const visibility = () => {
			if (!document.hidden) check();
		};
		window.addEventListener('storage', storage);
		window.addEventListener('privacy-settings', openSettings);
		document.addEventListener('visibilitychange', visibility);
		const timer = setInterval(check, 60000);
		return () => {
			window.removeEventListener('storage', storage);
			window.removeEventListener('privacy-settings', openSettings);
			document.removeEventListener('visibilitychange', visibility);
			clearInterval(timer);
		};
	});
	$effect(() => {
		if (page.url.hash === '#privacy-settings') void openSettings();
	});
	async function openSettings(event?: Event) {
		settingsTrigger = (event as CustomEvent<HTMLElement> | undefined)?.detail ?? null;
		open = true;
		await tick();
		document.getElementById('privacy-title')?.focus();
	}
	async function choose(statistics: boolean) {
		storageFailed = !saveConsent(statistics);
		if (!storageFailed || !statistics) {
			if (page.url.hash === '#privacy-settings') {
				replaceState(page.url.pathname + page.url.search, page.state);
			}
			open = false;
			await tick();
			settingsTrigger?.focus();
		}
	}
</script>

{#if open}
	<section class="consent" aria-labelledby="privacy-title">
		<h2 id="privacy-title" tabindex="-1">Cookies &amp; privacy</h2>
		<p>
			We use essential cookies and storage to run the game. Choose Accept to enable optional usage
			statistics.
			<a href={resolve('/privacy')}>Privacy policy</a>
		</p>
		{#if storageFailed}<p role="status">
				Your browser could not save this choice. Optional statistics remain off.
			</p>{/if}
		<div class="choices">
			<Button onclick={() => choose(false)}>Essential only</Button>
			<Button onclick={() => choose(true)}>Accept</Button>
		</div>
	</section>
{/if}

<style>
	.consent {
		position: fixed;
		bottom: var(--space-4);
		left: 50%;
		transform: translateX(-50%);
		z-index: 1000;
		width: min(560px, calc(100% - 32px));
		max-height: calc(100dvh - 32px);
		overflow: auto;
		padding: var(--space-5);
		border-radius: var(--radius-panel);
		background: var(--surface);
		box-shadow: 0 8px 32px #0008;
	}
	h2 {
		font-size: 20px;
		margin-bottom: var(--space-3);
	}
	p {
		line-height: 1.5;
		margin-bottom: var(--space-4);
	}
	a {
		text-decoration: underline;
	}
	.choices {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-3);
	}
	.choices :global(button) {
		border: 0;
	}
	:global(.consent button:focus-visible),
	a:focus-visible {
		outline: 2px solid var(--text);
		outline-offset: 3px;
	}
</style>
