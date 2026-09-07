<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
	let refreshing = $state(false);
	let refreshFailed = $state(false);
	const number = (n: number) => n.toLocaleString('en-US');
	async function refresh() {
		if (refreshing) return;
		refreshing = true;
		try {
			await invalidateAll();
			refreshFailed = false;
		} catch {
			refreshFailed = true;
		} finally {
			refreshing = false;
		}
	}
	onMount(() => {
		const timer = setInterval(() => {
			if (!document.hidden) void refresh();
		}, 60000);
		return () => clearInterval(timer);
	});
</script>

<svelte:head>
	<title>Game stats · 4D chess</title>
	<meta
		name="description"
		content="Total multiplayer games, completed games, and recent activity on 4D chess."
	/>
	<link rel="canonical" href="https://4dchess.lol/stats" />
</svelte:head>

<main>
	<header>
		<h1>Game stats</h1>
		<a href={resolve('/')}>Play 4D chess ↗</a>
	</header>
	{#if data.stats}
		{@const stats = data.stats}
		<p class="scope">Online multiplayer games</p>
		<p class="updated">
			Updated <time datetime={new Date(stats.sampledAt).toISOString()}
				>{new Date(stats.sampledAt).toISOString().slice(0, 16).replace('T', ' ')} UTC</time
			>. Refreshes every 5 minutes.
		</p>
		{#if data.stale || refreshFailed}<div role="status">
				<p>Updates are delayed. These are the last available counts.</p>
				<button onclick={refresh} disabled={refreshing}
					>{refreshing ? 'Checking…' : 'Check again'}</button
				>
			</div>{/if}
		<dl class="totals">
			<div class="total">
				<dt>Games started</dt>
				<dd>{number(stats.started)}</dd>
			</div>
			<div>
				<dt>Completed</dt>
				<dd>{number(stats.completed)}</dd>
				<p class="note">
					{stats.checkmates === undefined
						? 'Checkmates updating…'
						: `${number(stats.checkmates)} by checkmate`}
				</p>
			</div>
			<div>
				<dt>Unfinished</dt>
				<dd>{number(stats.active)}</dd>
			</div>
		</dl>
		<p class="note">Unfinished games may include abandoned sessions.</p>
		<section class="activity" aria-labelledby="activity-title">
			<h2 id="activity-title">Daily activity</h2>
			<table>
				<thead><tr><th scope="col">Day · UTC</th><th scope="col">Games</th></tr></thead><tbody>
					{#each [...stats.daily].reverse() as day (day.date)}<tr
							><th scope="row"
								><time datetime={day.date}
									>{new Date(day.date + 'T00:00:00Z').toLocaleDateString('en-US', {
										month: 'short',
										day: 'numeric',
										timeZone: 'UTC'
									})}</time
								>{#if day.date === stats.daily.at(-1)?.date}
									<span class="note"> · so far</span>{/if}</th
							><td>{number(day.started)}</td></tr
						>{/each}
				</tbody>
			</table>
		</section>
		<details>
			<summary>What counts as a game?</summary>
			<p>
				Recorded multiplayer games, including rematches. Unused invitations, cancelled and aborted
				games, and games against the computer are excluded. Unfinished means no result has been
				recorded; it is not a count of people online. Counts are collected over a short interval and
				may lag behind play. No player identities or room links are published.
			</p>
		</details>
	{:else}
		<section role="status">
			<h2>{data.unavailable ? 'Stats are unavailable' : 'Waiting for the first update'}</h2>
			<p>
				{data.unavailable
					? 'The game counts could not be loaded.'
					: 'Counts update every 5 minutes.'}
			</p>
			<button onclick={refresh} disabled={refreshing}
				>{refreshing ? 'Checking…' : 'Check again'}</button
			>
		</section>
	{/if}
</main>

<style>
	main {
		max-width: 760px;
		margin: 0 auto;
		padding: 40px 24px;
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 24px;
		margin-bottom: 40px;
	}
	h1 {
		font-size: 24px;
		margin: 0;
	}
	h2 {
		font-size: 18px;
	}
	a {
		color: var(--text);
		text-underline-offset: 4px;
	}
	p {
		line-height: 1.5;
	}
	.scope,
	dt,
	.totals .note {
		margin: 8px 0 0;
	}
	.note,
	.updated {
		color: var(--muted);
	}
	.scope {
		margin-bottom: 24px;
	}
	.totals {
		display: grid;
		grid-template-columns: 2fr 1fr 1fr;
		gap: 24px;
		align-items: start;
	}
	dd {
		font-family: var(--font-data);
		font-size: 28px;
		margin: 12px 0 0;
	}
	.total dd {
		font-size: 48px;
	}
	.note,
	.updated {
		font-size: 13px;
	}
	.note {
		margin: 24px 0;
	}
	.updated {
		margin: 0 0 28px;
	}
	.activity {
		margin-top: 32px;
	}
	table {
		width: 100%;
		border-collapse: collapse;
	}
	th,
	td {
		padding: 10px 0;
		border-bottom: 1px solid var(--line);
		text-align: left;
	}
	th {
		font-weight: 400;
	}
	thead {
		color: var(--muted);
		font-size: 13px;
	}
	td,
	th:last-child {
		text-align: right;
	}
	td {
		font-family: var(--font-data);
	}
	details {
		margin-top: 24px;
		color: var(--muted);
		font-size: 13px;
		line-height: 1.5;
	}
	summary {
		cursor: pointer;
		min-height: 44px;
		display: list-item;
		align-content: center;
	}
	button {
		min-height: 44px;
		padding: 8px 16px;
		border: 1px solid var(--line);
		border-radius: 8px;
		background: var(--surface);
		color: var(--text);
		cursor: pointer;
	}
	button:disabled {
		opacity: 0.6;
		cursor: wait;
	}
	@media (max-width: 480px) {
		main {
			padding: 24px 20px;
		}
		header {
			gap: 12px;
		}
		header a {
			font-size: 14px;
		}
		.totals {
			grid-template-columns: 1fr 1fr;
		}
		.total {
			grid-column: 1/-1;
		}
	}
</style>
