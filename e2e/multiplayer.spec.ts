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
	await white.getByRole('radio', { name: 'White', exact: true }).check();
	await white.getByRole('combobox', { name: 'Time', exact: true }).click();
	await white.getByRole('option', { name: 'Untimed', exact: true }).click();
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
	await expect(choices).toHaveCount(3);
	await expect(choices.nth(0)).toHaveAccessibleName('Find opponent');
	await expect(choices.nth(1)).toHaveAccessibleName('Play with friend');
	await expect(choices.nth(2)).toHaveAccessibleName('Play computer');
	await page.getByRole('radio', { name: 'White', exact: true }).check();
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
	let sendResignation: (() => void) | undefined;
	const { white, black, whiteContext, blackContext } = await friends(browser, async (page) => {
		await page.routeWebSocket(/convex\.cloud|127\.0\.0\.1:3320/, (socket) => {
			const server = socket.connectToServer();
			socket.onMessage((message) => {
				const data = JSON.parse(String(message));
				if (data.type === 'Mutation' && data.udfPath === 'games:resign') {
					sendResignation = () => server.send(message);
				} else server.send(message);
			});
		});
	});
	try {
		await white.getByRole('button', { name: 'Resign', exact: true }).click();
		await expect(white.getByRole('dialog', { name: 'Resign this game?' })).toHaveCount(0);
		await expect.poll(() => !!sendResignation).toBe(true);
		const confirm = white.getByRole('button', { name: 'Resign', exact: true });
		await expect(confirm).toHaveText('Resign');
		await expect(confirm).toHaveAttribute('aria-busy', 'true');
		await expect(confirm).toBeDisabled();
		sendResignation!();
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
	await expect(page.getByRole('button', { name: 'Back to play', exact: true })).toHaveCount(0);
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

test('the landing demo keeps playing after manual camera interaction', async ({ page }) => {
	await page.goto(process.env.E2E_BASE_URL!);
	const demo = page.locator('[data-demo-ply]');
	await expect(page.getByRole('button', { name: /^(Pause|Play) demo$/ })).toHaveCount(0);
	await expect(demo).toHaveAttribute('data-demo-phase', 'selection');
	const route = page.locator('.demo-path');
	await expect(route).toHaveCount(1);
	const path = await route.getAttribute('d');
	await expect(demo).toHaveAttribute('data-demo-phase', 'preview');
	await expect(route).toHaveAttribute('d', path!);
	await expect(demo).toHaveAttribute('data-demo-phase', 'move');
	await expect(route).toHaveAttribute('d', path!);
	await expect(demo).toHaveAttribute('data-demo-phase', 'settle');
	await expect(route).toHaveCount(0);
	await expect(page.locator('.threat-arrow, [data-state="inspection-target"]')).toHaveCount(0);
	await page.locator('.space-svg').press('ArrowRight');
	const point = page.locator('.space-svg [data-node="0"] circle').first();
	const manualX = await point.getAttribute('cx');
	await expect
		.poll(async () => Number(await demo.getAttribute('data-demo-ply')), { timeout: 20000 })
		.toBeGreaterThanOrEqual(3);
	await expect(point).toHaveAttribute('cx', manualX!);
	await expect(
		page.locator('.motion-path, .last-move-arrow, .demo-endpoint, [data-state="last-move"]')
	).toHaveCount(0);
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

test('demo resumes its camera after a minute without interaction', async ({ page }) => {
	test.setTimeout(90000);
	await page.goto(process.env.E2E_BASE_URL!);
	for (let i = 0; i < 12; i++) await page.locator('.space-svg').press('d');
	await page.waitForTimeout(3000);
	await page.locator('.space-svg').press('a');
	const point = page.locator('.space-svg [data-node="0"] circle').first();
	const manualX = await point.getAttribute('cx');
	await page.waitForTimeout(58000);
	await expect(point).toHaveAttribute('cx', manualX!);
	await expect.poll(() => point.getAttribute('cx'), { timeout: 15000 }).not.toBe(manualX);
});

test('home and game start with identical piece projection and neutral transparent surfaces', async ({
	page
}) => {
	await page.goto(process.env.E2E_BASE_URL!);
	await page.locator('.space-svg').press('Home');
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
	await page.getByRole('radio', { name: 'White', exact: true }).check();
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
		await expect(white.getByRole('button', { name: 'Resign', exact: true })).not.toHaveAttribute(
			'aria-busy',
			'true'
		);
		await expect(white.locator('.turn-indicator .spinner')).toHaveCount(0);
		await expect(white.getByText('Waiting for server confirmation…', { exact: true })).toHaveCount(
			0
		);
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
		await expect(white.getByLabel('Black wins', { exact: true })).toBeVisible();
		await white.getByRole('button', { name: 'Back to play', exact: true }).click();
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
		await expect(white.getByRole('button', { name: 'Back to play', exact: true })).toHaveCount(0);
		await move(white, 0, 32);
		await expect(black.getByLabel('Black to move', { exact: true })).toBeVisible();
		await black.getByRole('button', { name: 'Resign', exact: true }).click();
		await expect(white.getByRole('heading', { name: 'You won!', exact: true })).toBeVisible();
		await expect(white.getByRole('button', { name: 'Back to play', exact: true })).toBeVisible();
		await expect(white.locator('.player-profile').last().locator('.series-score')).toHaveText(
			'1.0'
		);
		await expect(white.locator('.player-profile').first().locator('.series-score')).toHaveText(
			'0.0'
		);
		await expect(black.locator('.player-profile').last().locator('.series-score')).toHaveText(
			'0.0'
		);
		await expect(black.locator('.player-profile').first().locator('.series-score')).toHaveText(
			'1.0'
		);
		await white.getByRole('button', { name: 'Rematch', exact: true }).click();
		await expect(white.getByText('Rematch requested', { exact: true })).toBeVisible();
		await expect(black.getByText('Your friend wants a rematch.', { exact: true })).toBeVisible();
		await black.screenshot({ path: '/tmp/rematch-request.png' });
		await expect(white.getByRole('heading', { name: 'You won!', exact: true })).toBeVisible();
		await black.getByRole('button', { name: 'Decline', exact: true }).click();
		await white.getByRole('button', { name: 'Rematch', exact: true }).click();
		await black.getByRole('button', { name: 'Accept rematch', exact: true }).click();
		await expect(white.locator('.player-profile').last().locator('.series-score')).toHaveText(
			'1.0'
		);
		await expect(black.locator('.player-profile').last().locator('.series-score')).toHaveText(
			'0.0'
		);
		for (const player of [white, black]) {
			await expect(player.getByLabel('White to move', { exact: true })).toBeVisible();
			await expect(player).toHaveURL(roomUrl);
			await expect(player.locator('[data-ply]')).toHaveCount(0);
			await expect(player.getByRole('button', { name: 'Back to play', exact: true })).toHaveCount(
				0
			);
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
		await expect(white.getByRole('heading', { name: 'You won!', exact: true })).toBeVisible();
		await white.getByRole('button', { name: 'Back to play', exact: true }).click();
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

test('matchmaking pairs guests, starts clocks, and keeps them running across reloads', async ({
	browser
}) => {
	const aContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
	const bContext = await browser.newContext({
		viewport: { width: 390, height: 844 },
		isMobile: true,
		hasTouch: true
	});
	const a = await aContext.newPage(),
		b = await bContext.newPage();
	try {
		await a.goto(process.env.E2E_BASE_URL!);
		await a.getByRole('button', { name: 'Find opponent', exact: true }).click();
		await expect(a.getByRole('heading', { name: 'Finding an opponent' })).toBeVisible();
		await b.goto(process.env.E2E_BASE_URL!);
		await b.getByRole('button', { name: 'Find opponent', exact: true }).click();
		await expect(a).toHaveURL(/\/room\//);
		await expect(b).toHaveURL(a.url());
		await expect(a.getByRole('timer')).toHaveCount(2);
		await expect(b.getByRole('timer')).toHaveCount(2);
		const white = (await a.locator('.player-profile').last().getAttribute('aria-label'))!.endsWith(
			'white, you'
		)
			? a
			: b;
		const black = white === a ? b : a;
		await move(white, 0, 32);
		await expect(black.getByRole('timer', { name: 'Black clock', exact: true })).toHaveClass(
			/running/
		);
		await move(black, 63, 31);
		await black.reload();
		await expect(black.getByRole('timer', { name: 'White clock', exact: true })).toHaveClass(
			/running/
		);
		await expect(black.locator('[data-ply]')).toHaveCount(2);
		await a.screenshot({ path: '/tmp/timed-match-desktop.png' });
		await b.screenshot({ path: '/tmp/timed-match-mobile.png', fullPage: true });
		if ((black.viewportSize()?.width ?? 1440) <= 850)
			await black.getByRole('button', { name: 'Options', exact: true }).click();
		await black.getByRole('button', { name: 'Resign', exact: true }).click();
		await expect(white.getByRole('heading', { name: 'You won!', exact: true })).toBeVisible();
		const result = white.getByRole('dialog', { name: 'Game result', exact: true });
		await expect(result.getByRole('button', { name: 'New game', exact: true })).toHaveClass(
			/primary/
		);
		await expect(result.getByRole('button', { name: 'Rematch', exact: true })).not.toHaveClass(
			/primary/
		);
		await result.getByRole('button', { name: 'New game', exact: true }).click();
		await expect(white).toHaveURL(/\/match\?time=10%2B5/);
		await white.getByRole('button', { name: 'Cancel search', exact: true }).click();
	} finally {
		await aContext.close();
		await bContext.close();
	}
});

test('a searching guest can cancel through the home logo without getting requeued', async ({
	page
}) => {
	await page.goto(process.env.E2E_BASE_URL!);
	await page.getByRole('button', { name: 'Find opponent', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Finding an opponent' })).toBeVisible();
	await page.getByRole('link', { name: '4D chess home', exact: true }).first().click();
	await expect(page.getByRole('button', { name: 'Find opponent', exact: true })).toBeVisible();
	await page.reload();
	await expect(page.getByRole('button', { name: 'Find opponent', exact: true })).toBeVisible();
});

test('friend challenges can remain untimed while matchmaking requires a clock', async ({
	browser
}) => {
	const first = await browser.newContext(),
		second = await browser.newContext();
	const a = await first.newPage(),
		b = await second.newPage();
	try {
		await a.goto(process.env.E2E_BASE_URL!);
		await a.getByRole('combobox', { name: 'Time', exact: true }).click();
		await a.getByRole('option', { name: 'Untimed', exact: true }).click();
		await expect(a.getByRole('button', { name: 'Find opponent', exact: true })).toBeDisabled();
		await a.getByRole('button', { name: 'Play with friend', exact: true }).click();
		const url = await a.getByRole('textbox', { name: 'Invitation link' }).inputValue();
		await b.goto(url);
		await expect(b.locator('.challenge-details')).toContainText('Untimed');
		await b.getByRole('button', { name: 'Accept challenge', exact: true }).click();
		await expect(a.getByLabel('White to move', { exact: true })).toBeVisible();
		await expect(a.getByRole('timer')).toHaveCount(0);
		await expect(b.getByRole('timer')).toHaveCount(0);
		await move(a, 0, 32);
		await expect(b.getByLabel('Black to move', { exact: true })).toBeVisible();
		await b.getByRole('button', { name: 'Resign', exact: true }).click();
		await expect(a.getByRole('heading', { name: 'You won!', exact: true })).toBeVisible();
	} finally {
		await first.close();
		await second.close();
	}
});

test('home defaults to Random and friend challenges assign a concrete side', async ({ page }) => {
	await page.addInitScript(() => {
		const original = crypto.getRandomValues.bind(crypto);
		crypto.getRandomValues = ((array: Uint8Array) => {
			if (array instanceof Uint8Array && array.length === 1) {
				array[0] = 1;
				return array;
			}
			return original(array);
		}) as typeof crypto.getRandomValues;
	});
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto(process.env.E2E_BASE_URL!);
	await expect(page.getByRole('radio', { name: 'Random', exact: true })).toBeChecked();
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
	await page.screenshot({ path: '/tmp/random-side-mobile.png' });
	await page.getByRole('button', { name: 'Play with friend', exact: true }).click();
	await expect(page.getByLabel('Waiting for your friend', { exact: true })).toBeVisible();
	await expect(page.locator('.player-profile').last()).toHaveAttribute('aria-label', /black, you/);
	await page.reload();
	await expect(page.locator('.player-profile').last()).toHaveAttribute('aria-label', /black, you/);
	await page.getByRole('link', { name: '4D chess home', exact: true }).first().click();
	await page
		.getByRole('dialog')
		.getByRole('button', { name: 'Delete challenge', exact: true })
		.click();
	await expect(page.getByRole('radio', { name: 'Random', exact: true })).toBeChecked();
});

for (const missingSide of ['white', 'black'] as const) {
	test(`matchmaking ${missingSide} first-move deadline survives reload and aborts without points`, async ({
		browser
	}) => {
		const aContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
		const bContext = await browser.newContext({
			viewport: { width: 390, height: 844 },
			isMobile: true,
			hasTouch: true
		});
		const a = await aContext.newPage(),
			b = await bContext.newPage();
		try {
			await a.goto(process.env.E2E_BASE_URL!);
			await a.getByRole('button', { name: 'Find opponent', exact: true }).click();
			await b.goto(process.env.E2E_BASE_URL!);
			await b.getByRole('button', { name: 'Find opponent', exact: true }).click();
			await expect(a).toHaveURL(/\/room\//);
			await expect(b).toHaveURL(a.url());
			await expect(a.locator('.player-profile').last()).toHaveAttribute(
				'aria-label',
				/, (white|black), you/
			);
			const white = (await a
				.locator('.player-profile')
				.last()
				.getAttribute('aria-label'))!.includes(', white,')
				? a
				: b;
			const black = white === a ? b : a;
			await expect(white.getByText(/Make your first move ·/)).toBeVisible();
			await expect(black.getByText(/Waiting for opponent ·/)).toBeVisible();
			if (missingSide === 'black') {
				await move(white, 0, 32);
				await expect(black.getByText(/Make your first move ·/)).toBeVisible();
				await expect(white.getByText(/Waiting for opponent ·/)).toBeVisible();
			}
			const idle = missingSide === 'white' ? white : black;
			await idle.reload();
			await expect(idle.getByText(/Make your first move ·/)).toBeVisible();
			await expect(idle.getByText(/Move now ·/)).toBeVisible({ timeout: 35000 });
			await idle.screenshot({ path: `/tmp/first-move-${missingSide}-warning.png` });
			for (const player of [a, b]) {
				await expect(
					player.getByRole('heading', { name: 'Game aborted', exact: true })
				).toBeVisible({ timeout: 20000 });
				await expect(player.locator('.series-score')).toHaveCount(0);
				await expect(player.getByRole('button', { name: 'New game', exact: true })).toBeVisible();
				await expect(player.getByRole('button', { name: 'Rematch', exact: true })).toHaveCount(0);
			}
			await idle.reload();
			await expect(idle.getByRole('heading', { name: 'Game aborted', exact: true })).toBeVisible();
			await expect(
				idle.getByRole('heading', { name: 'Finding an opponent', exact: true })
			).toHaveCount(0);
			await idle.getByRole('button', { name: 'New game', exact: true }).click();
			await expect(
				idle.getByRole('heading', { name: 'Finding an opponent', exact: true })
			).toBeVisible();
			await expect(idle.getByText('10 + 5 · Unrated · Random side')).toBeVisible();
			await idle.getByRole('button', { name: 'Cancel search', exact: true }).click();
			await expect(idle.getByRole('button', { name: 'Find opponent', exact: true })).toBeVisible();
		} finally {
			await aContext.close();
			await bContext.close();
		}
	});
}

test('spectators explore private branches and follow live moves and rematches', async ({
	browser
}) => {
	const { white, black, whiteContext, blackContext } = await friends(browser);
	const viewerContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
	const viewer = await viewerContext.newPage();
	const mutations: string[] = [],
		signups: string[] = [];
	viewer.on('request', (request) => {
		if (request.url().includes('/sign-in/anonymous')) signups.push(request.url());
	});
	viewer.on('websocket', (socket) => {
		if (!/convex\.cloud|127\.0\.0\.1:3320/.test(socket.url())) return;
		socket.on('framesent', ({ payload }) => {
			const data = JSON.parse(String(payload));
			if (data.type === 'Mutation') mutations.push(data.udfPath);
		});
	});
	try {
		await viewer.goto(white.url());
		await expect(viewer.getByRole('complementary', { name: 'Spectator controls' })).toBeVisible();
		await expect(viewer.getByRole('button', { name: 'Resign', exact: true })).toHaveCount(0);
		await move(viewer, 0, 32);
		await expect(viewer.getByText('Local analysis · Move 1', { exact: true })).toBeVisible();
		await expect(viewer.locator('.board-stage')).toHaveClass(/variation/);
		await expect(white.locator('[data-ply]')).toHaveCount(0);
		await expect(black.locator('[data-ply]')).toHaveCount(0);
		await viewer.keyboard.press('ArrowRight');
		await expect(viewer.locator('.board-stage')).not.toHaveClass(/variation/);
		await expect(viewer.locator('.cell[data-square="0"]')).toHaveAttribute(
			'aria-label',
			/White rook/
		);
		await viewer.getByRole('button', { name: /^Variation move 1:/ }).click();
		await move(white, 4, 8);
		await expect(white.locator('[data-ply="1"]')).toBeVisible();
		await white.keyboard.press('ArrowLeft');
		await expect(white.getByLabel('Reviewing move 0', { exact: true })).toBeVisible();
		await white.keyboard.press('ArrowRight');
		await expect(white.locator('[data-ply="1"]')).toHaveAttribute('aria-current', 'step');
		await expect(viewer.getByText('Live game · Move 1', { exact: true })).toBeVisible();
		await viewer.keyboard.press('ArrowLeft');
		await expect(viewer.getByText('Reviewing · Move 0', { exact: true })).toBeVisible();
		await viewer.keyboard.press('ArrowRight');
		await expect(viewer.getByRole('button', { name: 'Return to live', exact: true })).toHaveCount(
			0
		);
		await viewer.getByRole('button', { name: /^Variation move 1:/ }).click();
		await expect(viewer.locator('.cell[data-square="32"]')).toHaveAttribute(
			'aria-label',
			/White rook/
		);
		await expect(viewer.locator('.cell[data-square="4"]')).toHaveAttribute(
			'aria-label',
			/White pawn/
		);
		await viewer.getByRole('button', { name: 'Starting position', exact: true }).click();
		await move(viewer, 5, 9);
		await expect(viewer.getByRole('button', { name: /^Variation move 1:/ })).toHaveCount(2);
		await viewer.screenshot({ path: '/tmp/4d-spectator/branches-desktop.png', fullPage: true });
		await black.getByRole('button', { name: 'Resign', exact: true }).click();
		await white.getByRole('button', { name: 'Rematch', exact: true }).click();
		await black.getByRole('button', { name: 'Accept rematch', exact: true }).click();
		await expect(viewer.getByText('Game 2 has started.', { exact: true })).toBeVisible();
		await expect(viewer.locator('.cell[data-square="9"]')).toHaveAttribute(
			'aria-label',
			/White pawn/
		);
		await viewer.getByRole('button', { name: 'Return to live', exact: true }).click();
		await expect(viewer.getByText('Watching · Game 2', { exact: true })).toBeVisible();
		await expect(viewer.locator('.cell[data-square="5"]')).toHaveAttribute(
			'aria-label',
			/White pawn/
		);
		await viewer.getByRole('combobox', { name: 'Game', exact: true }).click();
		await viewer.getByRole('option', { name: 'Game 1', exact: true }).click();
		await expect(viewer.getByRole('button', { name: /^Variation move 1:/ })).toHaveCount(2);
		await viewer.getByRole('button', { name: 'Return to live', exact: true }).click();
		await move(black, 0, 32);
		await expect(viewer.locator('.cell[data-square="32"]')).toHaveAttribute(
			'aria-label',
			/White rook/
		);
		await expect(
			viewer.getByRole('status', { name: 'Loading move history', exact: true })
		).toHaveCount(0);
		await move(viewer, 56, 52);
		await expect(viewer.getByText('Local analysis · Move 2', { exact: true })).toBeVisible();
		await expect(black.locator('.cell[data-square="56"]')).toHaveAttribute(
			'aria-label',
			/Black pawn/
		);
		await viewer.getByRole('button', { name: 'Return to live', exact: true }).click();
		await viewer.setViewportSize({ width: 390, height: 844 });
		expect(await viewer.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
			true
		);
		await viewer.screenshot({ path: '/tmp/4d-spectator/live-mobile.png', fullPage: true });
		expect(mutations).toEqual([]);
		expect(signups).toEqual([]);
		await viewer.reload();
		await expect(viewer.getByText('Watching · Game 2', { exact: true })).toBeVisible();
		await move(viewer, 56, 52);
		await expect(viewer.getByText('Local analysis · Move 2', { exact: true })).toBeVisible();
		await viewer.getByRole('link', { name: '4D chess home', exact: true }).first().click();
		await expect(viewer.getByRole('button', { name: 'Find opponent', exact: true })).toBeVisible();
		await expect(viewer.getByRole('dialog')).toHaveCount(0);
	} finally {
		await viewerContext.close();
		await whiteContext.close();
		await blackContext.close();
	}
});

test('history animates backward and forward but rapid navigation becomes instant', async ({
	page
}) => {
	await page.goto(new URL('/computer?side=w', process.env.E2E_BASE_URL!).href);
	await move(page, 0, 32);
	await expect
		.poll(() =>
			page.evaluate(() => JSON.parse(localStorage.getItem('fourfold-computer-v1')!).moves.length)
		)
		.toBe(2);
	await expect(page.locator('[data-animation="piece"]')).toHaveCount(0);
	await page.keyboard.press('ArrowLeft');
	await expect(page.locator('[data-animation="piece"]')).toHaveCount(1);
	await expect(page.locator('[data-animation="spatial-piece"]')).toHaveCount(1);
	await expect(page.locator('[data-animation="piece"]')).toHaveCount(0);
	await page.keyboard.press('ArrowRight');
	await expect(page.locator('[data-animation="piece"]')).toHaveCount(1);
	await expect(page.locator('[data-animation="piece"]')).toHaveCount(0);
	await page.keyboard.press('ArrowLeft');
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('ArrowLeft');
	await page.keyboard.press('ArrowRight');
	await expect(page.locator('[data-animation="piece"]')).toHaveCount(0);
	await expect(page.locator('[data-ply="2"]')).toHaveAttribute('aria-current', 'step');
});

test('midgame reconnect clears the warning and a later disconnect forfeits without spectator presence', async ({
	browser
}) => {
	test.setTimeout(160000);
	const ac = await browser.newContext(),
		bc = await browser.newContext(),
		vc = await browser.newContext();
	const a = await ac.newPage(),
		b = await bc.newPage(),
		viewer = await vc.newPage();
	const sessionIds = new Map<Page, Set<string>>([
		[a, new Set()],
		[b, new Set()]
	]);
	for (const page of [a, b])
		page.on('websocket', (socket) => {
			if (!socket.url().includes('convex.cloud')) return;
			socket.on('framesent', ({ payload }) => {
				const message = JSON.parse(String(payload));
				if (message.type === 'Mutation' && message.udfPath === 'presence:heartbeat')
					sessionIds.get(page)!.add(message.args[0].sessionId);
			});
		});
	try {
		for (const page of [a, b]) {
			await page.goto(process.env.E2E_BASE_URL!);
			await page.getByRole('combobox', { name: 'Time', exact: true }).click();
			await page.getByRole('option', { name: '3 + 2', exact: true }).click();
			await page.getByRole('button', { name: 'Find opponent', exact: true }).click();
		}
		await expect(a).toHaveURL(/\/room\//);
		await expect(b).toHaveURL(a.url());
		await expect(a.locator('.player-profile').last()).toHaveAttribute(
			'aria-label',
			/, (white|black), you/
		);
		const white = (await a.locator('.player-profile').last().getAttribute('aria-label'))!.includes(
			', white,'
		)
			? a
			: b;
		const black = white === a ? b : a,
			whiteContext = white === a ? ac : bc,
			blackContext = white === a ? bc : ac;
		await move(white, 0, 32);
		await move(black, 63, 31);
		await expect(white.getByLabel('White to move', { exact: true })).toBeVisible();
		await whiteContext.setOffline(true);
		await expect(black.getByText(/Opponent disconnected\s*·/)).toBeVisible({ timeout: 40000 });
		await black.screenshot({ path: '/tmp/disconnect-warning.png', fullPage: true });
		await whiteContext.setOffline(false);
		await expect(black.getByText(/Opponent disconnected\s*·/)).toHaveCount(0);
		await move(white, 32, 36);
		await move(black, 31, 27);
		await expect(white.getByLabel('White to move', { exact: true })).toBeVisible();
		for (const page of [a, b]) expect(sessionIds.get(page)!.size).toBe(1);
		await viewer.goto(white.url());
		await expect(viewer.getByRole('complementary', { name: 'Spectator controls' })).toBeVisible();
		await whiteContext.setOffline(true);
		await expect(black.getByText(/Opponent disconnected\s*·/)).toBeVisible({ timeout: 40000 });
		await expect(viewer.getByText(/Opponent disconnected\s*·/)).toBeVisible();
		await expect(black.getByRole('heading', { name: 'You won!', exact: true })).toBeVisible({
			timeout: 40000
		});
		await expect(
			black.getByText('Game abandoned after disconnection.', { exact: true })
		).toBeVisible();
		await whiteContext.setOffline(false);
		await expect(white.getByRole('heading', { name: 'You lost', exact: true })).toBeVisible();
		await expect(viewer.getByText('Black wins', { exact: true })).toBeVisible();
		await blackContext.setOffline(false);
	} finally {
		await ac.close();
		await bc.close();
		await vc.close();
	}
});

test('a hidden playing tab remains present after another tab closes', async ({ browser }) => {
	test.setTimeout(90000);
	const ac = await browser.newContext(),
		bc = await browser.newContext();
	const a = await ac.newPage(),
		b = await bc.newPage();
	try {
		for (const p of [a, b]) {
			await p.goto(process.env.E2E_BASE_URL!);
			await p.getByRole('button', { name: 'Find opponent', exact: true }).click();
		}
		await expect(a).toHaveURL(/\/room\//);
		await expect(b).toHaveURL(a.url());
		await expect(a.locator('.player-profile').last()).toHaveAttribute(
			'aria-label',
			/, (white|black), you/
		);
		const white = (await a.locator('.player-profile').last().getAttribute('aria-label'))!.includes(
			', white,'
		)
			? a
			: b;
		const black = white === a ? b : a;
		await move(white, 0, 32);
		await move(black, 63, 31);
		const extra = await white.context().newPage();
		await extra.goto(white.url());
		await expect(extra.getByLabel('White to move', { exact: true })).toBeVisible();
		await expect(extra.locator('.cell[data-square="32"]')).toHaveAttribute(
			'aria-disabled',
			'false'
		);
		await extra.evaluate(() => {
			Object.defineProperty(document, 'hidden', { value: true, configurable: true });
			document.dispatchEvent(new Event('visibilitychange'));
		});
		await white.close();
		// Longer than the lease duration, to prove the remaining hidden tab still renews it.
		await extra.waitForTimeout(35000);
		await expect(black.locator('.reconnect-notice').first()).toHaveText('');
		await expect(extra.getByRole('button', { name: 'Resign', exact: true })).toBeVisible();
		await extra.getByRole('button', { name: 'Resign', exact: true }).click();
		await expect(black.getByRole('heading', { name: 'You won!', exact: true })).toBeVisible();
	} finally {
		await ac.close();
		await bc.close();
	}
});

test('game profiles stay symmetric as notices appear and controls live in the sidebar', async ({
	browser
}) => {
	const ac = await browser.newContext({ viewport: { width: 1440, height: 1000 } }),
		bc = await browser.newContext();
	const a = await ac.newPage(),
		b = await bc.newPage();
	try {
		for (const p of [a, b]) {
			await p.goto(process.env.E2E_BASE_URL!);
			await p.getByRole('button', { name: 'Find opponent', exact: true }).click();
		}
		await expect(a).toHaveURL(/\/room\//);
		await expect(a.locator('.player-profile')).toHaveCount(2);
		const measure = () =>
			a.evaluate(() => {
				const profiles = [...document.querySelectorAll('.board-stage > .player-profile')].map(
					(el) => el.getBoundingClientRect()
				);
				const squares = [...document.querySelectorAll('.board-stage .board')].map((el) =>
					el.getBoundingClientRect()
				);
				const board = {
					top: Math.min(...squares.map((rect) => rect.top)),
					bottom: Math.max(...squares.map((rect) => rect.bottom))
				};
				return {
					top: board.top - profiles[0].bottom,
					bottom: profiles[1].top - board.bottom,
					height: profiles[0].height,
					boardTop: board.top,
					boardBottom: board.bottom
				};
			});
		const before = await measure();
		expect(Math.abs(before.top - before.bottom)).toBeLessThan(1);
		await expect(a.locator('.first-move-notice').filter({ hasText: /0:/ })).toHaveCount(1);
		expect(await measure()).toEqual(before);
		const center = await a.locator('.space-svg').evaluate((svg) => {
			const ys = [...svg.querySelectorAll(':scope > line[stroke="var(--grid)"]')].flatMap((el) => [
				Number(el.getAttribute('y1')),
				Number(el.getAttribute('y2'))
			]);
			return (Math.min(...ys) + Math.max(...ys)) / 2;
		});
		expect(center).toBeCloseTo(252.97747136395708, 4);
		await expect(a.getByLabel('Threat controls')).not.toBeVisible();
		await a.getByRole('button', { name: 'Board controls', exact: true }).click();
		await expect(a.getByRole('dialog', { name: 'Board controls', exact: true })).toBeVisible();
		await expect(a.getByLabel('Threat controls')).toBeVisible();
		await a.keyboard.press('Escape');
		await expect(a.getByRole('dialog', { name: 'Board controls', exact: true })).not.toBeVisible();
		await a.screenshot({ path: '/tmp/room-alignment-desktop.png', fullPage: true });
		await a.setViewportSize({ width: 390, height: 844 });
		expect(await a.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
		await a.getByRole('button', { name: 'Board controls', exact: true }).click();
		await expect(a.getByRole('dialog', { name: 'Board controls', exact: true })).toBeVisible();
		await a.keyboard.press('Escape');
		await a.getByRole('button', { name: 'Resign', exact: true }).click();
	} finally {
		await ac.close();
		await bc.close();
	}
});

test('profiles show captured pieces and material advantage for the reviewed position', async ({
	browser
}) => {
	const { white, black, whiteContext, blackContext } = await friends(browser);
	try {
		await move(white, 0, 32);
		await move(black, 45, 33);
		await move(white, 32, 33);
		const profile = white.locator('.player-profile').last();
		await expect(profile.locator('.captured-pieces svg')).toHaveCount(1);
		await expect(profile.locator('.material-advantage')).toHaveText('+5');
		await white.keyboard.press('ArrowLeft');
		await expect(profile.locator('.captured-pieces svg')).toHaveCount(0);
		await expect(profile.locator('.material-advantage')).toHaveCount(0);
		await white.keyboard.press('ArrowRight');
		await expect(profile.locator('.captured-pieces svg')).toHaveCount(1);
		await expect(profile.locator('.material-advantage')).toHaveText('+5');
		await white.screenshot({ path: '/tmp/profile-captures-desktop.png', fullPage: true });
		await black.getByRole('button', { name: 'Resign', exact: true }).click();
	} finally {
		await whiteContext.close();
		await blackContext.close();
	}
});

test('tesseract separates selection and pinned threats with colored one-pixel indicators', async ({
	page
}) => {
	await page.goto(new URL('/computer?side=w', process.env.E2E_BASE_URL!).href);
	await page.locator('.cell[data-square="3"]').click();
	await expect(page.locator('.space-svg [data-state="selected"]')).toHaveCount(1);
	const legal = await page.locator('.cell.legal').count();
	expect(legal).toBeGreaterThan(0);
	await expect(page.locator('.space-svg [data-state="legal-destination"]')).toHaveCount(legal);
	await expect(page.locator('.space-svg .legal-move-line')).toHaveCount(legal);
	const svg = page.locator('.space-svg');
	const box = (await svg.boundingBox())!;
	await page.mouse.move(box.x + 12, box.y + 12);
	await page.mouse.down();
	await page.mouse.move(box.x + 42, box.y + 22);
	await page.mouse.up();
	await expect(page.locator('.space-svg .legal-move-line')).toHaveCount(legal);
	for (const i of [45, 61, 17])
		await page.locator(`.cell[data-square="${i}"]`).click({ button: 'right' });
	await expect(page.locator('.space-svg [data-state="inspection-target"]')).toHaveCount(3);
	await svg.click({ position: { x: 12, y: 12 } });
	await expect(page.locator('.space-svg [data-state="inspection-target"]')).toHaveCount(3);
	await page.locator('.space-svg [data-node="32"]').click();
	await expect(
		page.locator('.space-svg [data-node="32"] [data-state="inspection-target"]')
	).toHaveAttribute('r', '3');
	await expect(page.locator('.cell[data-square="32"]')).toHaveClass(/threat-target/);
	await page.locator('.space-svg [data-node="0"]').click();
	await expect(
		page.locator('.space-svg [data-node="0"] [data-state="inspection-target"]')
	).toHaveAttribute('r', '12');
	await expect(page.locator('.cell[data-square="0"]')).toHaveClass(/threat-target/);
	await expect(
		page.locator('.space-svg [data-node="0"] [data-state="inspection-target"]')
	).toHaveCSS('opacity', '0.95');
	await page.screenshot({ path: '/tmp/tesseract-ui/refined-inspection.png', fullPage: true });
	await expect(page.locator('.space-svg [data-state="selected"]')).toHaveCount(0);
	await expect(page.locator('.space-svg [data-state="legal-destination"]')).toHaveCount(0);
	await page.locator('.cell[data-square="44"]').click({ button: 'right' });
	const colors = await page
		.locator('.space-svg .threat-arrow')
		.evaluateAll((lines) => [...new Set(lines.map((line) => getComputedStyle(line).stroke))]);
	expect(colors).toContain('rgb(114, 203, 230)');
	expect(colors).toContain('rgb(241, 135, 150)');
	const widths = await page.locator('.space-svg > line').evaluateAll((lines) =>
		lines.map((line) => ({
			width: getComputedStyle(line).strokeWidth,
			effect: getComputedStyle(line).vectorEffect
		}))
	);
	expect(widths.every((line) => line.width === '1px' && line.effect === 'non-scaling-stroke')).toBe(
		true
	);
	await page.locator('.cell[data-square="20"]').click();
	await expect(page.locator('.space-svg .threat-arrow')).toHaveCount(0);
	await page.locator('.space-svg [data-node="0"]').click();
	await expect(page.locator('.cell[data-square="0"]')).toHaveClass(/selected/);
	await page.locator('.space-svg [data-node="0"]').click();
	await expect(page.locator('.cell[data-square="0"]')).toHaveClass(/selected/);
	await page.locator('.space-svg [data-node="32"]').click();
	await expect(page.locator('.cell[data-square="32"]')).toHaveAttribute('aria-label', /White rook/);
	await expect
		.poll(() =>
			page.evaluate(() => JSON.parse(localStorage.getItem('fourfold-computer-v1')!).moves.length)
		)
		.toBe(2);
	await expect(page.locator('.space-svg [data-state="last-move"]')).toHaveCount(2);
	await expect(page.locator('.space-svg .last-move-arrow')).toHaveAttribute(
		'marker-end',
		/^url\(#/
	);
	await page.screenshot({ path: '/tmp/tesseract-ui/refined-last-move.png', fullPage: true });
	await page.setViewportSize({ width: 390, height: 844 });
	await page.locator('.cell[data-square="3"]').click();
	await expect(page.locator('.space-svg [data-state="selected"]')).toHaveCSS('opacity', '1');
	await page.screenshot({ path: '/tmp/tesseract-ui/after-mobile.png', fullPage: true });
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('mobile game controls stay reachable and results can be closed and reopened', async ({
	page
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(new URL('/computer', process.env.E2E_BASE_URL!).href);
	await expect(page.locator('.player-profile')).toHaveCount(2);
	await expect(page.locator('.rank-coordinate')).toHaveCount(16);
	await expect(page.locator('.file-coordinate')).toHaveCount(16);
	await expect(page.locator('.ranks, .files')).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Resign', exact: true })).toBeHidden();
	await move(page, 0, 32);
	await expect(page.getByRole('button', { name: 'Previous move', exact: true })).toBeEnabled();
	await page.getByRole('button', { name: 'Previous move', exact: true }).click();
	await page.getByRole('button', { name: 'Return to live game', exact: true }).click();
	await page.getByRole('button', { name: 'Options', exact: true }).click();
	await page.getByRole('button', { name: 'Resign', exact: true }).click();
	const result = page.getByRole('dialog', { name: 'Game result', exact: true });
	await expect(result).toBeVisible();
	await expect(result).toContainText('You lost');
	await expect(result.getByRole('button', { name: 'Review game', exact: true })).toHaveCount(0);
	await page.getByRole('button', { name: 'Close result', exact: true }).click();
	await expect(result).toBeHidden();
	await expect(page.getByRole('button', { name: 'Options', exact: true })).toHaveAttribute(
		'aria-expanded',
		'false'
	);
	await page.getByRole('button', { name: 'Result', exact: true }).click();
	await expect(result).toBeVisible();
	await result.getByRole('button', { name: 'New game', exact: true }).click();
	await expect(result).toBeHidden();
	const layout = await page.evaluate(() => {
		const own = document.querySelector('.player-profile:last-of-type')!.getBoundingClientRect();
		const controls = document.querySelector('.mobile-game-controls')!.getBoundingClientRect();
		return {
			ownBottom: own.bottom,
			controlsTop: controls.top,
			overflow: document.documentElement.scrollWidth > innerWidth
		};
	});
	expect(layout.ownBottom).toBeLessThan(layout.controlsTop);
	expect(layout.overflow).toBe(false);
	await page.setViewportSize({ width: 1440, height: 1000 });
	await page.getByRole('button', { name: 'Resign', exact: true }).click();
	await expect(result).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(result).toBeHidden();
});

// This case uses only the local computer game; it does not create backend matches.
test('focused tesseract reserves Left and Right for move history', async ({ page }) => {
	await page.goto(new URL('/computer?side=w', process.env.E2E_BASE_URL!).href);
	await move(page, 0, 32);
	await expect
		.poll(() =>
			page.evaluate(() => JSON.parse(localStorage.getItem('fourfold-computer-v1')!).moves.length)
		)
		.toBe(2);
	await expect(page.locator('[data-animation="piece"]')).toHaveCount(0);
	const tesseract = page.locator('.space-svg');
	const planes = () =>
		tesseract.locator('polygon').evaluateAll((nodes) => nodes.map((n) => n.getAttribute('points')));
	await tesseract.focus();
	const original = await planes();
	await page.keyboard.press('ArrowLeft');
	await expect(page.locator('[data-ply="1"]')).toHaveAttribute('aria-current', 'step');
	expect(await planes()).toEqual(original);
	await page.keyboard.press('ArrowRight');
	await expect(page.locator('[data-ply="2"]')).toHaveAttribute('aria-current', 'step');
	expect(await planes()).toEqual(original);
	await tesseract.press('a');
	expect(await planes()).not.toEqual(original);
	await tesseract.press('Home');
	expect(await planes()).toEqual(original);
	await page.getByRole('button', { name: 'Board controls', exact: true }).click();
	const volume = page.getByLabel('Volume', { exact: true });
	await volume.focus();
	await page.keyboard.press('ArrowLeft');
	await expect(page.locator('[data-ply="2"]')).toHaveAttribute('aria-current', 'step');
});
