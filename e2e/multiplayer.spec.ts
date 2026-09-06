import { test, expect, type Page, type Browser } from '@playwright/test';

test.skip(
	!process.env.E2E_BASE_URL,
	'Set E2E_BASE_URL explicitly. These checks create guest matches on its backend.'
);

test('lessons teach one move at a time and free practice supports either side and undo', async ({
	page
}) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(process.env.E2E_BASE_URL!);
	await expect(page.locator('.site-header')).toHaveCount(0);
	await expect(page.getByRole('radio', { name: 'White', exact: true })).toBeChecked();
	await expect(page.locator('.space-svg')).toBeVisible();
	await page.getByRole('link', { name: 'Learn how to play', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Rook: try a move' })).toBeVisible();
	await page.locator('[data-square="0"]').click();
	await page.locator('[data-square="32"]').click();
	await expect(page.getByRole('status')).toContainText('That’s it');
	await page.getByRole('button', { name: 'Next lesson', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Bishop: try a move' })).toBeVisible();
	await page.getByRole('button', { name: 'Show move', exact: true }).click();
	await expect(page.getByRole('status')).toContainText('That’s it');
	await page.getByRole('button', { name: 'Free practice', exact: true }).click();
	await page.getByRole('button', { name: 'Full position', exact: true }).click();
	await page.locator('[data-square="63"]').click();
	await expect(page.locator('.cell.legal').first()).toBeVisible();
	await page.locator('.cell.legal').first().click();
	await page.getByRole('button', { name: 'Undo', exact: true }).click();
	await expect(page.locator('[data-square="63"]')).toHaveAttribute('aria-label', /Black rook/);
	await page.setViewportSize({ width: 390, height: 844 });
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

async function friends(browser: Browser, setup?: (page: Page) => Promise<void>) {
	const whiteContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
	const blackContext = await browser.newContext({
		viewport: { width: 390, height: 844 },
		isMobile: true,
		hasTouch: true
	});
	const white = await whiteContext.newPage(),
		black = await blackContext.newPage();
	await setup?.(white);
	await white.goto(process.env.E2E_BASE_URL!);
	await white.getByRole('button', { name: 'Play with friend', exact: true }).click();
	await expect(white.getByLabel('Waiting for your friend', { exact: true })).toBeVisible();
	const invitation = await white.getByRole('textbox', { name: 'Invitation link' }).inputValue();
	await black.goto(invitation);
	await expect(black.getByRole('heading', { name: 'Accept challenge' })).toBeVisible();
	const challenger = await white.locator('.player-profile').last().locator('strong').innerText();
	await expect(black.locator('.challenger')).toContainText(challenger);
	await black.screenshot({ path: '/tmp/challenge-mobile.png' });
	await black.setViewportSize({ width: 1440, height: 1000 });
	await black.screenshot({ path: '/tmp/challenge-desktop.png' });
	await black.setViewportSize({ width: 390, height: 844 });
	await black.getByRole('button', { name: 'Accept challenge', exact: true }).click();
	await expect(black.getByLabel('White to move', { exact: true })).toBeVisible();
	await expect(white.getByLabel('White to move', { exact: true })).toBeVisible();
	await white.screenshot({ path: '/tmp/player-frame-desktop.png' });
	return { white, black, whiteContext, blackContext };
}

async function move(page: Page, from: number, to: number) {
	const source = page.locator(`.cell[data-square="${from}"]`);
	await expect(source).toHaveAttribute('aria-disabled', 'false');
	await source.click();
	const destination = page.locator(`.cell[data-square="${to}"]`);
	await expect(destination).toHaveClass(/legal/);
	await destination.click();
}

test('friends synchronize, recover a lost acknowledgement, reconnect, and finish by repetition', async ({
	browser
}) => {
	const { white, black, whiteContext, blackContext } = await friends(browser);
	try {
		await expect(black.locator('.cell').first()).toHaveAttribute('data-square', '19');
		expect(await black.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
			true
		);
		await move(white, 0, 32);
		await expect(black.getByLabel('Black to move', { exact: true })).toBeVisible();
		// Simulate a crash before the accepted move's persistent pending record is cleared.
		await black.evaluate(() => {
			const remove = Storage.prototype.removeItem;
			Storage.prototype.removeItem = function (key: string) {
				if (this === sessionStorage && key.startsWith('fourfold-pending-')) return;
				remove.call(this, key);
			};
		});
		await move(black, 63, 31);
		await expect(black.getByLabel('White to move', { exact: true })).toBeVisible();
		expect(
			await black.evaluate(() =>
				Object.keys(sessionStorage).some((key) => key.startsWith('fourfold-pending-'))
			)
		).toBe(true);
		await black.reload();
		await expect(black.getByLabel('White to move', { exact: true })).toBeVisible();
		await expect
			.poll(() =>
				black.evaluate(() =>
					Object.keys(sessionStorage).some((key) => key.startsWith('fourfold-pending-'))
				)
			)
			.toBe(false);
		await whiteContext.setOffline(true);
		await expect(
			white.getByText('Connection lost. Your room is saved. Reconnecting…')
		).toBeVisible();
		await expect(white.locator('.cell').first()).toHaveAttribute('aria-disabled', 'true');
		await whiteContext.setOffline(false);
		await expect(white.locator('.cell').first()).toHaveAttribute('aria-disabled', 'false');
		for (const [player, from, to] of [
			[white, 32, 0],
			[black, 31, 63],
			[white, 0, 32],
			[black, 63, 31],
			[white, 32, 0],
			[black, 31, 63]
		] as const) {
			await move(player, from, to);
		}
		for (const player of [white, black]) {
			await expect(player.getByLabel('Game drawn', { exact: true })).toBeVisible();
			await expect(player.getByText('Draw by repetition.')).toBeVisible();
			await expect(player.locator('.cell').first()).toHaveAttribute('aria-disabled', 'true');
		}
		await expect(
			black.getByRole('region', { name: 'Moves', exact: true }).locator('[data-ply]')
		).toHaveCount(8);
		await black.getByRole('button', { name: 'Export game', exact: true }).click();
		await expect(black.getByRole('textbox', { name: '4D PGN notation' })).toBeVisible();
		await expect
			.poll(() => black.getByRole('textbox', { name: '4D PGN notation' }).inputValue())
			.toContain('1/2-1/2');
		await black.keyboard.press('Escape');
		await black.reload();
		await expect(black.getByLabel('Game drawn', { exact: true })).toBeVisible();
	} finally {
		await whiteContext.close();
		await blackContext.close();
	}
});

test('computer play uses no backend, supports threat inspection, animation, export, and restore', async ({
	page
}) => {
	const backendRequests: string[] = [];
	page.on('request', (request) => {
		const url = new URL(request.url());
		if (
			url.hostname.endsWith('.convex.cloud') ||
			url.hostname.endsWith('.convex.site') ||
			url.pathname.startsWith('/api/auth/')
		)
			backendRequests.push(url.pathname);
	});
	await page.goto(process.env.E2E_BASE_URL!);
	const choices = page.getByRole('region', { name: 'Choose how to play' }).getByRole('button');
	await expect(choices).toHaveCount(2);
	await expect(choices.nth(0)).toHaveAccessibleName('Play with friend');
	await expect(choices.nth(1)).toHaveAccessibleName('Play computer');
	await page.getByRole('button', { name: 'Play computer', exact: true }).click();
	await expect(page.getByLabel('White to move', { exact: true })).toBeVisible();
	const before = await page.evaluate(() => localStorage.getItem('fourfold-computer-v1'));
	await page.locator('[data-square="2"]').click({ button: 'right' });
	await expect(page.locator('.cell.threat-target')).toHaveCount(1);
	await expect(page.getByLabel('Threat controls')).toContainText('Right-click');
	expect(await page.evaluate(() => localStorage.getItem('fourfold-computer-v1'))).toBe(before);
	await page.locator('[data-square="20"]').click();
	await move(page, 0, 32);
	await expect(page.locator('[data-animation="piece"]')).toHaveCount(1);
	await expect(page.locator('[data-animation="spatial-piece"]')).toHaveCount(1);
	await expect
		.poll(() =>
			page.evaluate(() => JSON.parse(localStorage.getItem('fourfold-computer-v1')!).moves.length)
		)
		.toBe(2);
	await expect(page.getByLabel('White to move', { exact: true })).toBeVisible();
	await page.reload();
	await expect(page.getByLabel('White to move', { exact: true })).toBeVisible();
	expect(
		await page.evaluate(
			() => JSON.parse(localStorage.getItem('fourfold-computer-v1')!).moves.length
		)
	).toBe(2);
	await page.getByRole('button', { name: 'Export game', exact: true }).click();
	await expect
		.poll(() => page.getByRole('textbox', { name: '4D PGN notation' }).inputValue())
		.toContain('[Black "Computer (Easy)"]');
	const download = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Download PGN' }).click();
	expect((await download).suggestedFilename()).toBe('4d-chess.pgn');
	expect(backendRequests).toEqual([]);
});

test('computer can play White and reduced-motion preference disables moving overlays', async ({
	page
}) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(new URL('/computer?side=b', process.env.E2E_BASE_URL!).href);

	await expect(page.getByLabel('Black to move', { exact: true })).toBeVisible();
	await expect(page.locator('[data-animation]')).toHaveCount(0);
	expect(
		await page.evaluate(
			() => JSON.parse(localStorage.getItem('fourfold-computer-v1')!).moves.length
		)
	).toBe(1);
	await page.reload();
	await expect(page.getByLabel('Black to move', { exact: true })).toBeVisible();
});

test('resignation requires confirmation and updates both players', async ({ browser }) => {
	const { white, black, whiteContext, blackContext } = await friends(browser);
	try {
		await white.getByRole('button', { name: 'Resign', exact: true }).click();
		await white.getByRole('button', { name: 'Keep playing' }).click();
		await expect(white.getByLabel('White to move', { exact: true })).toBeVisible();
		await white.getByRole('button', { name: 'Resign', exact: true }).click();
		await white.getByRole('button', { name: 'Resign game', exact: true }).click();
		await expect(white.getByLabel('Black wins', { exact: true })).toBeVisible();
		await expect(black.getByLabel('Black wins', { exact: true })).toBeVisible();
		await expect(black.getByRole('region', { name: 'Game over' })).toContainText('You won!');
		await expect(white.getByRole('region', { name: 'Game over' })).toContainText('You lost');
		await expect(white.getByRole('region', { name: 'Game over' })).toContainText('resignation');
	} finally {
		await whiteContext.close();
		await blackContext.close();
	}
});

test('waiting rooms persist, copy without relabeling, and delete cleanly', async ({
	page,
	context
}) => {
	await page.goto(process.env.E2E_BASE_URL!);
	const white = page.getByRole('radio', { name: 'White', exact: true });
	await expect(white).toBeEnabled();
	await white.focus();
	await white.press('ArrowRight');
	await expect(page.getByRole('radio', { name: 'Black', exact: true })).toBeChecked();
	await page.getByRole('button', { name: 'Play with friend', exact: true }).click();
	await expect(page.getByLabel('Waiting for your friend', { exact: true })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Leave room', exact: true })).toHaveCount(0);
	await expect(page.getByRole('textbox', { name: 'Invitation link' })).not.toHaveValue('');
	const roomUrl = page.url();
	const guestName = await page.evaluate(async () => {
		const response = await fetch('/api/auth/get-session');
		return (await response.json()).user.name as string;
	});
	expect(guestName).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+ [1-9]\d{3}$/);
	await expect(page.locator('.player-profile').last().locator('strong')).toHaveText(guestName);
	const invite = await page.getByRole('textbox', { name: 'Invitation link' }).inputValue();
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	const copy = page.getByRole('button', { name: 'Copy invitation', exact: true });
	await copy.click();
	await expect(page.getByRole('status').filter({ hasText: 'Invitation copied' })).toHaveText(
		'Invitation copied'
	);
	await expect(copy).toHaveText('Copy invitation');
	expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(invite);
	await expect(page.getByRole('status').filter({ hasText: 'Invitation copied' })).toHaveCount(0);
	await page.goto(process.env.E2E_BASE_URL!);
	await expect(page).toHaveURL(roomUrl);
	await expect(page.locator('.player-profile').last().locator('strong')).toHaveText(guestName);
	await expect(page.getByRole('textbox', { name: 'Invitation link' })).toHaveValue(invite);
	await page.screenshot({ path: '/tmp/waiting-room-refined.png' });
	await expect(page.locator('.home-link.corner')).toHaveText('');
	await context.setOffline(true);
	const openedImmediately = await page.evaluate(() => {
		(document.querySelector('.home-link.corner') as HTMLAnchorElement).click();
		return [...document.querySelectorAll('dialog')].some((dialog) => dialog.open);
	});
	expect(openedImmediately).toBe(true);
	await expect(page.getByRole('dialog', { name: 'Delete this challenge?' })).toBeVisible();
	await page.getByRole('button', { name: 'Keep challenge', exact: true }).click();
	await context.setOffline(false);
	await expect(page).toHaveURL(roomUrl);
	await page.getByRole('link', { name: '4D chess home', exact: true }).first().click();
	await page
		.getByRole('dialog')
		.getByRole('button', { name: 'Delete challenge', exact: true })
		.click();
	await expect(page.getByRole('button', { name: 'Play with friend', exact: true })).toBeVisible();
});

test('practice places either color and keeps both-color threat arrows until a board click', async ({
	page
}) => {
	await page.goto(new URL('/how-to-play', process.env.E2E_BASE_URL!).href);
	await expect(page.getByRole('button', { name: 'Show move', exact: true })).toBeEnabled();
	await page.getByRole('button', { name: 'Free practice', exact: true }).click();
	await page.getByRole('button', { name: 'Place pieces', exact: true }).click();
	const white = page.getByRole('radio', { name: 'White', exact: true });
	await white.focus();
	await white.press('ArrowRight');
	await page.locator('[data-square="3"]').click();
	await expect(page.locator('[data-square="3"]')).toHaveAttribute('aria-label', /Black rook/);
	await page.getByRole('button', { name: 'Move pieces', exact: true }).click();
	await page.locator('[data-square="1"]').click({ button: 'right' });
	await expect(page.locator('.overlay .threat-arrow')).toHaveCount(2);
	const colors = await page
		.locator('.overlay .threat-arrow')
		.evaluateAll((lines) => lines.map((line) => getComputedStyle(line).stroke));
	expect(new Set(colors).size).toBe(2);
	await page.locator('[data-square="2"]').click({ button: 'right' });
	await expect(page.locator('.cell.threat-target')).toHaveCount(2);
	await expect(page.locator('.overlay .threat-arrow')).toHaveCount(4);
	await expect(page.locator('.space-svg .threat-arrow')).toHaveCount(4);
	await page.locator('[data-square="17"]').click();
	await expect(page.locator('.threat-arrow')).toHaveCount(0);
	await page.getByRole('button', { name: 'Place pieces', exact: true }).click();
	await page.getByRole('button', { name: 'Knight', exact: true }).click();
	await page.getByRole('button', { name: 'Starting square', exact: true }).click();
	await expect(page.locator('[data-square="62"]')).toHaveAttribute('aria-label', /Black knight/);
	await page.locator('[data-square="17"]').click();
	await expect(page.locator('[data-square="17"]')).toHaveAttribute('aria-label', /Black knight/);
	await page.getByRole('button', { name: 'Undo', exact: true }).click();
	await expect(page.locator('[data-square="17"]')).toHaveAttribute('aria-label', /empty/);
});

test('the landing demo searches live moves and can be paused', async ({ page }) => {
	await page.goto(process.env.E2E_BASE_URL!);
	const demo = page.locator('[data-demo-ply]');
	await expect
		.poll(async () => Number(await demo.getAttribute('data-demo-ply')))
		.toBeGreaterThanOrEqual(2);
	await page.getByRole('button', { name: 'Pause demo', exact: true }).click();
	const ply = await demo.getAttribute('data-demo-ply');
	await page.waitForTimeout(2500);
	await expect(demo).toHaveAttribute('data-demo-ply', ply!);
	await page.getByRole('button', { name: 'Play demo', exact: true }).click();
	await expect
		.poll(async () => Number(await demo.getAttribute('data-demo-ply')))
		.toBeGreaterThan(Number(ply));
});

test('computer sidebar settings apply to new games and export dismisses outside', async ({
	page
}) => {
	await page.goto(new URL('/computer', process.env.E2E_BASE_URL!).href);
	await expect(page.getByLabel('White to move', { exact: true })).toBeVisible();
	await expect(page.getByText('Back to play', { exact: true })).toHaveCount(0);
	await expect(page.getByText('Options', { exact: true })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'New game', exact: true })).toHaveCount(0);
	await page.getByRole('button', { name: 'Resign', exact: true }).click();
	await page.getByRole('button', { name: 'Resign game', exact: true }).click();
	await page.getByRole('radio', { name: 'White', exact: true }).focus();
	await page.getByRole('radio', { name: 'White', exact: true }).press('ArrowRight');
	await page.getByRole('combobox', { name: 'Difficulty', exact: true }).click();
	await page.getByRole('option', { name: 'Medium', exact: true }).click();
	await page.getByRole('button', { name: 'New game', exact: true }).click();
	await expect
		.poll(() =>
			page.evaluate(() => {
				const saved = JSON.parse(localStorage.getItem('fourfold-computer-v1')!);
				return { player: saved.player, difficulty: saved.difficulty };
			})
		)
		.toEqual({ player: 'b', difficulty: 'medium' });
	await page.getByRole('button', { name: 'Export game', exact: true }).click();
	const dialog = page.getByRole('dialog', { name: 'Export game', exact: true });
	await expect(dialog).toBeVisible();
	await expect(page.getByRole('button', { name: 'Close export' })).toHaveCount(0);
	await page.mouse.click(2, 2);
	await expect(dialog).not.toBeVisible();
});

test('duplicate kings only show the selected square’s moves', async ({ page }) => {
	await page.goto(new URL('/how-to-play', process.env.E2E_BASE_URL!).href);
	await page.getByRole('button', { name: 'Free practice', exact: true }).click();
	await page.getByRole('button', { name: 'Place pieces', exact: true }).click();
	await page.getByRole('button', { name: 'King', exact: true }).click();
	for (const square of [26, 11, 2]) await page.locator(`[data-square="${square}"]`).click();
	await page.getByRole('button', { name: 'Move pieces', exact: true }).click();
	await page.locator('[data-square="26"]').click();
	const destinations = await page
		.locator('.cell.legal')
		.evaluateAll((cells) => cells.map((cell) => Number(cell.getAttribute('data-square'))));
	expect(destinations).toHaveLength(34);
	for (const square of destinations) {
		const coordinates = [
			square % 4,
			Math.floor(square / 4) % 4,
			Math.floor(square / 16) % 2,
			Math.floor(square / 32)
		];
		expect(Math.max(...coordinates.map((v, i) => Math.abs(v - [2, 2, 1, 0][i])))).toBe(1);
	}
	await expect(page.locator('[data-square="1"]')).not.toHaveClass(/legal/);
	await page.locator('[data-square="1"]').click();
	await expect(page.locator('[data-square="26"]')).toHaveAttribute('aria-label', /White king/);
	await expect(page.locator('[data-square="1"]')).toHaveAttribute('aria-label', /empty/);
	await page.locator('[data-square="2"]').click();
	await expect(page.locator('[data-square="1"]')).toHaveClass(/legal/);
});

test('styled selects support keyboard choice and outside dismissal', async ({ page }) => {
	await page.goto(new URL('/computer', process.env.E2E_BASE_URL!).href);
	await page.getByRole('button', { name: 'Resign', exact: true }).click();
	await page.getByRole('button', { name: 'Resign game', exact: true }).click();
	const select = page.getByRole('combobox', { name: 'Difficulty', exact: true });
	await select.click();
	await expect(page.getByRole('listbox', { name: 'Difficulty' })).toBeVisible();
	await select.press('End');
	await select.press('Enter');
	await expect(select).toHaveText('Extreme');
	await select.click();
	await page.mouse.click(2, 2);
	await expect(select).toHaveAttribute('aria-expanded', 'false');
	await select.focus();
	await select.press('m');
	await select.press('Enter');
	await expect(select).toHaveText('Medium');
});

test('home and game use identical tesseract canvas dimensions', async ({ page }) => {
	for (const width of [1920, 1440, 900, 390]) {
		if (page.url().includes('/computer')) {
			await page.getByRole('button', { name: 'Resign', exact: true }).click();
			await page.getByRole('button', { name: 'Resign game', exact: true }).click();
			await page.getByRole('button', { name: 'Leave game', exact: true }).click();
			await page.evaluate(() => localStorage.removeItem('fourfold-computer-v1'));
		}
		await page.setViewportSize({ width, height: 1080 });
		await page.goto(process.env.E2E_BASE_URL!);
		const home = await page.locator('.space-svg').boundingBox();
		await page.goto(new URL('/computer', process.env.E2E_BASE_URL!).href);
		await expect(page.getByLabel('White to move', { exact: true })).toBeVisible();
		const game = await page.locator('.space-svg').boundingBox();
		expect(home!.width).toBeCloseTo(game!.width, 0);
		expect(home!.height).toBeCloseTo(game!.height, 0);
	}
});

test('touch inspection uses a short long-press hint without an inspection panel', async ({
	browser
}) => {
	const context = await browser.newContext({
		viewport: { width: 390, height: 844 },
		isMobile: true,
		hasTouch: true
	});
	try {
		const page = await context.newPage();
		await page.goto(new URL('/how-to-play', process.env.E2E_BASE_URL!).href);
		await expect(page.locator('.touch-hint')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Inspect threats', exact: true })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Clear inspection', exact: true })).toHaveCount(
			0
		);
	} finally {
		await context.close();
	}
});

test('demo holds its selected piece and freezes mid-move when paused', async ({ page }) => {
	await page.goto(process.env.E2E_BASE_URL!);
	const demo = page.locator('[data-demo-phase]');
	await expect(demo).toHaveAttribute('data-demo-phase', 'selection');
	await page.getByRole('button', { name: 'Pause demo', exact: true }).click();
	await expect(page.locator('[data-animation="spatial-piece"]')).toHaveCount(0);
	await expect(page.locator('.space-svg .piece')).toHaveCount(20);
	await page.waitForTimeout(1300);
	await expect(demo).toHaveAttribute('data-demo-phase', 'selection');
	await page.locator('.space-svg').press('ArrowRight');
	const point = page.locator('.space-svg [data-node="0"] circle').first();
	const manualX = await point.getAttribute('cx');
	await page.getByRole('button', { name: 'Play demo', exact: true }).click();
	await expect(point).toHaveAttribute('cx', manualX!);
	await expect(demo).toHaveAttribute('data-demo-phase', 'move');
	await page.getByRole('button', { name: 'Pause demo', exact: true }).click();
	const mover = page.locator('[data-animation="spatial-piece"] .piece');
	const before = await mover.getAttribute('x');
	await page.waitForTimeout(600);
	await expect(mover).toHaveAttribute('x', before!);
	await page.getByRole('button', { name: 'Play demo', exact: true }).click();
	await expect
		.poll(async () => Number(await demo.getAttribute('data-demo-ply')))
		.toBeGreaterThanOrEqual(1);
});

test('home and game start with identical piece projection and neutral transparent surfaces', async ({
	page
}) => {
	await page.goto(process.env.E2E_BASE_URL!);
	await page.getByRole('button', { name: 'Pause demo', exact: true }).click();
	const points = () =>
		page.locator('.space-svg [data-node]').evaluateAll((nodes) =>
			Object.fromEntries(
				nodes.map((node) => {
					const c = node.querySelector('circle')!;
					return [node.getAttribute('data-node'), [c.getAttribute('cx'), c.getAttribute('cy')]];
				})
			)
		);
	const home = await points();
	await page.goto(new URL('/computer', process.env.E2E_BASE_URL!).href);
	await expect(page.getByLabel('White to move', { exact: true })).toBeVisible();
	expect(await points()).toEqual(home);
	await expect(page.locator('.space-svg polygon').first()).toHaveAttribute('fill-opacity', '.025');
	const color = await page
		.locator('.spatial')
		.evaluate((el) => getComputedStyle(el).getPropertyValue('--grid').trim());
	expect(color).toBe('#828282');
	await expect(page.getByRole('button', { name: 'Resign', exact: true })).toBeVisible();
});

test('computer history stays saved while players freely leave and resume', async ({ page }) => {
	await page.goto(process.env.E2E_BASE_URL!);
	const primary = page.getByRole('button', { name: 'Play with friend', exact: true });
	expect(await primary.evaluate((el) => getComputedStyle(el).color)).toBe(
		await page.evaluate(() => getComputedStyle(document.body).color)
	);
	await page.getByRole('button', { name: 'Play computer', exact: true }).click();
	await expect(page.getByRole('button', { name: 'New game', exact: true })).toHaveCount(0);
	await move(page, 0, 32);
	await expect(page.getByLabel('White to move', { exact: true })).toBeVisible();
	await page.locator('[data-ply="1"]').click();
	await expect(page.locator('[data-ply="1"]')).toHaveAttribute('aria-current', 'step');
	await expect(page.getByLabel('Reviewing move 1', { exact: true })).toBeVisible();
	await expect(page.locator('[data-square="32"]')).toHaveAttribute('aria-label', /White rook/);
	await expect(page.locator('[data-square="32"]')).toHaveAttribute('aria-disabled', 'true');
	await page.getByRole('button', { name: 'Live', exact: true }).click();
	await expect(page.locator('[data-ply="2"]')).toHaveAttribute('aria-current', 'step');
	await page.goto(process.env.E2E_BASE_URL!);
	await expect(page.getByRole('button', { name: 'Play computer', exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Play computer', exact: true }).click();
	await expect(page.locator('[data-ply="2"]')).toHaveAttribute('aria-current', 'step');
	const saved = await page.evaluate(() => localStorage.getItem('fourfold-computer-v1'));
	await page.getByRole('link', { name: '4D chess home', exact: true }).first().click();
	await expect(page.getByRole('button', { name: 'Play computer', exact: true })).toBeVisible();
	await page.reload();
	await expect(page.getByRole('button', { name: 'Play computer', exact: true })).toBeVisible();
	expect(await page.evaluate(() => localStorage.getItem('fourfold-computer-v1'))).toBe(saved);
	await page.getByRole('button', { name: 'Play computer', exact: true }).click();
	await expect(page.locator('[data-ply="2"]')).toHaveAttribute('aria-current', 'step');
	await page.getByRole('button', { name: 'Resign', exact: true }).click();
	await page.getByRole('button', { name: 'Resign game', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Resign', exact: true })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'New game', exact: true })).toBeVisible();
	await page.reload();
	await expect(page.getByRole('heading', { name: 'You lost', exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Leave game', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Play with friend', exact: true })).toBeVisible();
	await page.reload();
	await expect(page.getByRole('button', { name: 'Play with friend', exact: true })).toBeVisible();
});

test('online moves display immediately, roll back rejection, and reconcile without duplication', async ({
	browser
}) => {
	let held: { accept: () => void; reject: () => void } | undefined,
		hold = true;
	const { white, black, whiteContext, blackContext } = await friends(browser, async (page) => {
		await page.routeWebSocket(/convex\.cloud|127\.0\.0\.1:3320/, (socket) => {
			const server = socket.connectToServer();
			socket.onMessage((message) => {
				const data = JSON.parse(String(message));
				if (hold && data.type === 'Mutation' && data.udfPath === 'moves:submit') {
					held = {
						accept: () => server.send(message),
						reject: () =>
							socket.send(
								JSON.stringify({
									type: 'MutationResponse',
									requestId: data.requestId,
									success: false,
									result: 'Rejected for test',
									errorData: 'ILLEGAL_MOVE',
									logLines: []
								})
							)
					};
				} else server.send(message);
			});
		});
	});
	try {
		await move(white, 0, 32);
		await expect.poll(() => !!held).toBe(true);
		await expect(white.locator('[data-square="32"]')).toHaveAttribute('aria-label', /White rook/);
		await expect(black.locator('[data-square="32"]')).toHaveAttribute('aria-label', /empty/);
		held!.reject();
		held = undefined;
		await expect(white.locator('[data-square="0"]')).toHaveAttribute('aria-label', /White rook/);
		await expect(white.locator('[data-square="32"]')).toHaveAttribute('aria-label', /empty/);
		await expect(white.getByRole('alert')).toContainText('not legal');
		await move(white, 0, 32);
		await expect.poll(() => !!held).toBe(true);
		await expect(white.locator('[data-square="32"]')).toHaveAttribute('aria-label', /White rook/);
		hold = false;
		held!.accept();
		await expect(black.getByLabel('Black to move', { exact: true })).toBeVisible();
		await expect(white.locator('[data-ply="1"]')).toHaveCount(1);
		await white.getByRole('button', { name: 'Previous move', exact: true }).click();
		await expect(white.locator('[data-square="0"]')).toHaveAttribute('aria-label', /White rook/);
		await white.getByRole('button', { name: 'Live', exact: true }).click();
		const url = white.url();
		await white.goto(process.env.E2E_BASE_URL!);
		await expect(white).toHaveURL(url);
		await white.getByRole('button', { name: 'Resign', exact: true }).click();
		await white.getByRole('button', { name: 'Resign game', exact: true }).click();
		await expect(white.getByLabel('Black wins', { exact: true })).toBeVisible();
		await white.getByRole('button', { name: 'Leave room', exact: true }).click();
		await expect(
			white.getByRole('button', { name: 'Play with friend', exact: true })
		).toBeVisible();
	} finally {
		await whiteContext.close();
		await blackContext.close();
	}
});

test('finished score sheet exports, dismisses with Escape, and restores after reload', async ({
	page
}) => {
	await page.addInitScript(() => {
		if (!sessionStorage.getItem('draw-seeded')) {
			localStorage.setItem(
				'fourfold-computer-v1',
				JSON.stringify({
					version: 1,
					player: 'w',
					difficulty: 'easy',
					startedAt: Date.now(),
					moves: [
						{ from: 0, to: 32 },
						{ from: 63, to: 31 },
						{ from: 32, to: 0 },
						{ from: 31, to: 63 },
						{ from: 0, to: 32 },
						{ from: 63, to: 31 },
						{ from: 32, to: 0 },
						{ from: 31, to: 63 }
					]
				})
			);
			sessionStorage.setItem('draw-seeded', '1');
		}
	});
	await page.goto(new URL('/computer', process.env.E2E_BASE_URL!).href);
	await expect(page.getByLabel('Game drawn', { exact: true })).toBeVisible();
	await expect(page.locator('[data-ply]')).toHaveCount(8);
	await page.getByRole('button', { name: 'Export game', exact: true }).click();
	await expect(page.getByRole('textbox', { name: '4D PGN notation' })).toHaveValue(/1\/2-1\/2/);
	await page.keyboard.press('Escape');
	await expect(page.getByRole('dialog', { name: 'Export game' })).not.toBeVisible();
	await page.reload();
	await expect(page.getByLabel('Game drawn', { exact: true })).toBeVisible();
});

test('a concluded computer game stops automatic home redirection', async ({ page }) => {
	await page.goto(new URL('/computer', process.env.E2E_BASE_URL!).href);
	await page.getByRole('button', { name: 'Resign', exact: true }).click();
	await page.getByRole('button', { name: 'Resign game', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'You lost', exact: true })).toBeVisible();
	await page.goto(process.env.E2E_BASE_URL!);
	await expect(page.getByRole('button', { name: 'Play with friend', exact: true })).toBeVisible();
	await page.reload();
	await expect(page.getByRole('button', { name: 'Play with friend', exact: true })).toBeVisible();
});

test('friends replay in the same room and recover a second-round move after reload', async ({
	browser
}) => {
	const { white, black, whiteContext, blackContext } = await friends(browser);
	try {
		const roomUrl = white.url();
		expect(roomUrl).toContain('/room/');
		expect(black.url()).toBe(roomUrl);
		await expect(white.getByRole('button', { name: 'Leave room', exact: true })).toHaveCount(0);
		await move(white, 0, 32);
		await expect(black.getByLabel('Black to move', { exact: true })).toBeVisible();
		await black.getByRole('button', { name: 'Resign', exact: true }).click();
		await black.getByRole('button', { name: 'Resign game', exact: true }).click();
		await expect(white.getByRole('heading', { name: 'You won!', exact: true })).toBeVisible();
		await expect(white.getByRole('button', { name: 'Leave room', exact: true })).toBeVisible();
		await expect(white.getByLabel('Room score')).toHaveText('You 1 Friend 0');
		await expect(black.getByLabel('Room score')).toHaveText('You 0 Friend 1');
		await white.getByRole('button', { name: 'Rematch', exact: true }).click();
		await expect(white.getByText('Rematch requested', { exact: true })).toBeVisible();
		await expect(black.getByText('Your friend wants a rematch.', { exact: true })).toBeVisible();
		await black.screenshot({ path: '/tmp/rematch-request.png' });
		await expect(white.getByRole('heading', { name: 'You won!', exact: true })).toBeVisible();
		await black.getByRole('button', { name: 'Decline', exact: true }).click();
		await white.getByRole('button', { name: 'Rematch', exact: true }).click();
		await black.getByRole('button', { name: 'Accept rematch', exact: true }).click();
		for (const player of [white, black]) {
			await expect(player.getByLabel('White to move', { exact: true })).toBeVisible();
			await expect(player).toHaveURL(roomUrl);
			await expect(player.locator('[data-ply]')).toHaveCount(0);
			await expect(player.getByRole('button', { name: 'Leave room', exact: true })).toHaveCount(0);
		}
		await expect(white.locator('.player-profile').last()).toHaveAttribute(
			'aria-label',
			/black, you$/
		);
		await expect(black.locator('.player-profile').last()).toHaveAttribute(
			'aria-label',
			/white, you$/
		);
		await black.evaluate(() => {
			const remove = Storage.prototype.removeItem;
			Storage.prototype.removeItem = function (key) {
				if (this === sessionStorage && key.startsWith('fourfold-pending-')) return;
				remove.call(this, key);
			};
		});
		await move(black, 0, 32);
		await expect(black.getByLabel('Black to move', { exact: true })).toBeVisible();
		expect(
			await black.evaluate(() =>
				Object.keys(sessionStorage).some((key) => key.startsWith('fourfold-pending-'))
			)
		).toBe(true);
		await black.reload();
		await expect(black.getByLabel('Black to move', { exact: true })).toBeVisible();
		await expect
			.poll(() =>
				black.evaluate(() =>
					Object.keys(sessionStorage).some((key) => key.startsWith('fourfold-pending-'))
				)
			)
			.toBe(false);
		await expect(black.locator('[data-ply]')).toHaveCount(1);
		await black.getByRole('button', { name: 'Resign', exact: true }).click();
		await black.getByRole('button', { name: 'Resign game', exact: true }).click();
		await expect(white.getByRole('heading', { name: 'You won!', exact: true })).toBeVisible();
		await white.getByRole('button', { name: 'Leave room', exact: true }).click();
		await expect(
			white.getByRole('button', { name: 'Play with friend', exact: true })
		).toBeVisible();
	} finally {
		await whiteContext.close();
		await blackContext.close();
	}
});

test('home logo requires resignation in an active friend game and permits a zero-move rematch', async ({
	browser
}) => {
	const { white, black, whiteContext, blackContext } = await friends(browser);
	try {
		await black.getByRole('link', { name: '4D chess home', exact: true }).first().click();
		await expect(black.getByRole('dialog', { name: 'Resign and go home?' })).toBeVisible();
		await black.getByRole('button', { name: 'Stay here', exact: true }).click();
		await expect(black.getByRole('button', { name: 'Resign', exact: true })).toBeVisible();
		const roomUrl = black.url();
		await black.getByRole('link', { name: '4D chess home', exact: true }).first().click();
		await black.getByRole('button', { name: 'Resign and go home', exact: true }).click();
		await expect(
			black.getByRole('button', { name: 'Play with friend', exact: true })
		).toBeVisible();
		await expect(white.getByRole('heading', { name: 'You won!', exact: true })).toBeVisible();
		await black.goto(roomUrl);
		await black.getByRole('button', { name: 'Rematch', exact: true }).click();
		await white.getByRole('button', { name: 'Accept rematch', exact: true }).click();
		await expect(black.getByLabel('White to move', { exact: true })).toBeVisible();
		await expect(black.locator('.player-profile').last()).toHaveAttribute(
			'aria-label',
			/white, you$/
		);
	} finally {
		await whiteContext.close();
		await blackContext.close();
	}
});
