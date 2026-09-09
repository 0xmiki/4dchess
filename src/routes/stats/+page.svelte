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
		<dl class="headline-grid">
			<div class="primary-metric">
				<dt>Player identities</dt>
				<dd>{stats.participants ? number(stats.participants.total) : 'Pending'}</dd>
				<p>Created on this service</p>
			</div>
			<div>
				<dt>New today</dt>
				<dd>{stats.participants ? number(stats.participants.newToday) : 'Pending'}</dd>
				<p>Since 00:00 UTC</p>
			</div>
			<div>
				<dt>Active today</dt>
				<dd>{stats.players ? number(stats.players.today) : 'Pending'}</dd>
				<p>Made a move</p>
			</div>
			<div>
				<dt>Games today</dt>
				<dd>
					{stats.today ? number(stats.today.started) : number(stats.daily.at(-1)?.started ?? 0)}
				</dd>
				<p>{stats.today ? `${number(stats.today.completed)} completed` : 'Started today'}</p>
			</div>
			<div>
				<dt>Live games</dt>
				<dd>{stats.playingNow === undefined ? 'Pending' : number(stats.playingNow)}</dd>
				<p>Both players online</p>
			</div>
			<div>
				<dt>Completion rate</dt>
				<dd>{stats.started ? `${Math.round((stats.completed / stats.started) * 100)}%` : '0%'}</dd>
				<p>{number(stats.completed)} of {number(stats.started)}</p>
			</div>
		</dl>
		<section class="activity" aria-labelledby="players-title">
			<div class="section-heading">
				<div>
					<p class="eyebrow">Reach</p>
					<h2 id="players-title">Active players</h2>
				</div>
				<p>Unique identities that made a move</p>
			</div>
			{#if stats.players}<dl class="players">
					<div>
						<dt>Today</dt>
						<dd>{number(stats.players.today)}</dd>
					</div>
					<div>
						<dt>Last 7 days</dt>
						<dd>{number(stats.players.week)}</dd>
					</div>
					<div>
						<dt>Last 30 days</dt>
						<dd>{number(stats.players.month)}</dd>
					</div>
				</dl>{:else}<p class="note">Player counts updating…</p>{/if}
		</section>
		<section class="activity" aria-labelledby="activity-title">
			<div class="section-heading">
				<div>
					<p class="eyebrow">Last 7 days</p>
					<h2 id="activity-title">Daily activity</h2>
				</div>
				<p>UTC, newest first</p>
			</div>
			<div class="table-wrap">
				<table>
					<thead
						><tr
							><th scope="col">Day</th><th scope="col">New players</th><th scope="col">Active</th
							><th scope="col">Started</th><th scope="col">Completed</th></tr
						></thead
					><tbody>
						{#each [...stats.daily].reverse() as day (day.date)}<tr
								><th scope="row"
									><time datetime={day.date}
										>{new Date(day.date + 'T00:00:00Z').toLocaleDateString('en-US', {
											month: 'short',
											day: 'numeric',
											timeZone: 'UTC'
										})}</time
									>{#if day.date === stats.daily.at(-1)?.date}<span class="note">
											· so far</span
										>{/if}</th
								><td>{day.newPlayers === undefined ? 'Pending' : number(day.newPlayers)}</td><td
									>{day.players === undefined ? 'Pending' : number(day.players)}</td
								><td>{number(day.started)}</td><td
									>{day.completed === undefined ? 'Pending' : number(day.completed)}</td
								></tr
							>{/each}
					</tbody>
				</table>
			</div>
		</section>
		<div class="breakdowns">
			<section class="activity" aria-labelledby="outcomes-title">
				<p class="eyebrow">Completed games</p>
				<h2 id="outcomes-title">How games end</h2>
				{#if stats.outcomes}<dl class="breakdown-list">
						<div>
							<dt>Checkmate</dt>
							<dd>{number(stats.outcomes.checkmate)}</dd>
						</div>
						<div>
							<dt>Resignation</dt>
							<dd>{number(stats.outcomes.resignation)}</dd>
						</div>
						<div>
							<dt>Draw</dt>
							<dd>{number(stats.outcomes.draw)}</dd>
						</div>
						<div>
							<dt>Timeout</dt>
							<dd>{number(stats.outcomes.timeout)}</dd>
						</div>
						<div>
							<dt>Disconnect</dt>
							<dd>{number(stats.outcomes.abandonment)}</dd>
						</div>
					</dl>{:else}<p class="note">Outcome counts updating…</p>{/if}
			</section>
			<section class="activity" aria-labelledby="formats-title">
				<p class="eyebrow">All games</p>
				<h2 id="formats-title">What people play</h2>
				{#if stats.gameKinds && stats.timeControls}<dl class="breakdown-list">
						<div>
							<dt>Friend games</dt>
							<dd>{number(stats.gameKinds.friend)}</dd>
						</div>
						<div>
							<dt>Matchmaking</dt>
							<dd>{number(stats.gameKinds.matchmaking)}</dd>
						</div>
						<div>
							<dt>3 + 2</dt>
							<dd>{number(stats.timeControls.bullet)}</dd>
						</div>
						<div>
							<dt>5 + 3</dt>
							<dd>{number(stats.timeControls.blitz)}</dd>
						</div>
						<div>
							<dt>10 + 5</dt>
							<dd>{number(stats.timeControls.rapid)}</dd>
						</div>
						<div>
							<dt>Untimed</dt>
							<dd>{number(stats.timeControls.untimed)}</dd>
						</div>
					</dl>{:else}<p class="note">Game format counts updating…</p>{/if}
			</section>
		</div>
		<details>
			<summary>How are these counted?</summary>
			<p>
				Player identities are browser or account records, not verified individual people. A guest
				using another browser or clearing their session can count again. Recorded multiplayer games
				include rematches. Unused invitations, cancelled and aborted games, and games against the
				computer are excluded. A live game has both players currently connected. Counts are
				collected over a short interval and may lag behind play. No player identities or room links
				are published. Active players are distinct player identities that made a move during the
				period, including moves in games later aborted. Page visits and computer games do not count.
				Seven-day and 30-day totals count distinct players across the whole period; they are not
				sums of the daily counts.
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
		max-width: 1040px;
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
		margin: 0;
	}
	a {
		color: var(--text);
		text-underline-offset: 4px;
	}
	p {
		line-height: 1.5;
	}
	.scope,
	dt {
		margin: 8px 0 0;
	}
	.note,
	.updated {
		color: var(--muted);
	}
	.scope {
		margin-bottom: 24px;
	}
	.players {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1px;
		margin-top: 20px;
		border: 1px solid var(--line);
		border-radius: 12px;
		overflow: hidden;
		background: var(--line);
	}
	.players > div {
		padding: 18px;
		background: var(--page);
	}
	.players dt {
		font-size: 13px;
	}
	.headline-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1px;
		margin-top: 28px;
		border: 1px solid var(--line);
		border-radius: 14px;
		overflow: hidden;
		background: var(--line);
	}
	.headline-grid > div {
		min-height: 150px;
		padding: 20px;
		background: var(--page);
	}
	.headline-grid dt,
	.eyebrow {
		margin: 0 0 5px;
		color: var(--muted);
		font-size: 12px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	.headline-grid p,
	.section-heading > p {
		color: var(--muted);
		font-size: 13px;
	}
	dd {
		font-family: var(--font-data);
		font-size: 28px;
		margin: 8px 0 0;
	}
	.primary-metric dd {
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
		margin-top: 48px;
	}
	.section-heading {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 20px;
		margin-bottom: 16px;
	}
	.table-wrap {
		overflow-x: auto;
	}
	table {
		width: 100%;
		min-width: 620px;
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
	th:not(:first-child) {
		text-align: right;
	}
	td {
		font-family: var(--font-data);
	}
	.breakdowns {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 48px;
	}
	.breakdown-list {
		margin-top: 16px;
		border-top: 1px solid var(--line);
	}
	.breakdown-list > div {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 16px;
		padding: 9px 0;
		border-bottom: 1px solid var(--line);
	}
	.breakdown-list dt,
	.breakdown-list dd {
		margin: 0;
	}
	.breakdown-list dd {
		font-size: 16px;
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
	@media (max-width: 700px) {
		main {
			padding: 24px 20px;
		}
		header {
			gap: 12px;
		}
		header a {
			font-size: 14px;
		}
		.headline-grid {
			grid-template-columns: 1fr 1fr;
		}
		.primary-metric {
			grid-column: 1/-1;
		}
		.breakdowns {
			grid-template-columns: 1fr;
			gap: 0;
		}
	}
	@media (max-width: 480px) {
		.headline-grid > div {
			min-height: 132px;
			padding: 16px;
		}
		.players {
			grid-template-columns: 1fr;
		}
		.section-heading {
			align-items: start;
			flex-direction: column;
			gap: 4px;
		}
	}
</style>
