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

async function friends(browser: Browser) {
	const whiteContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
	const blackContext = await browser.newContext({
		viewport: { width: 390, height: 844 },
		isMobile: true,
		hasTouch: true
	});
	const white = await whiteContext.newPage(),
		black = await blackContext.newPage();
	await white.goto(process.env.E2E_BASE_URL!);
	await white.getByRole('button', { name: 'Play with friend', exact: true }).click();
	await expect(white.getByRole('heading', { name: 'Waiting for your friend' })).toBeVisible();
	const invitation = await white.getByRole('textbox', { name: 'Invitation link' }).inputValue();
	await black.goto(invitation);
	await expect(black.getByRole('heading', { name: 'Join your friend' })).toBeVisible();
	await black.getByRole('button', { name: 'Join match', exact: true }).click();
	await expect(black.getByRole('heading', { name: 'White to move', exact: true })).toBeVisible();
	await expect(white.getByRole('heading', { name: 'White to move', exact: true })).toBeVisible();
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
		await expect(black.getByRole('heading', { name: 'Black to move', exact: true })).toBeVisible();
		// Simulate a crash before the accepted move's persistent pending record is cleared.
		await black.evaluate(() => {
			const remove = Storage.prototype.removeItem;
			Storage.prototype.removeItem = function (key: string) {
				if (this === sessionStorage && key.startsWith('fourfold-pending-')) return;
				remove.call(this, key);
			};
		});
		await move(black, 63, 31);
		await expect(black.getByRole('heading', { name: 'White to move', exact: true })).toBeVisible();
		expect(
			await black.evaluate(() =>
				Object.keys(sessionStorage).some((key) => key.startsWith('fourfold-pending-'))
			)
		).toBe(true);
		await black.reload();
		await expect(black.getByRole('heading', { name: 'White to move', exact: true })).toBeVisible();
		await expect
			.poll(() =>
				black.evaluate(() =>
					Object.keys(sessionStorage).some((key) => key.startsWith('fourfold-pending-'))
				)
			)
			.toBe(false);
		await whiteContext.setOffline(true);
		await expect(
			white.getByText('Connection lost. Your match is saved. Reconnecting…')
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
			await expect(player.getByRole('heading', { name: 'Game drawn' })).toBeVisible();
			await expect(player.getByText('Third repetition of the position.')).toBeVisible();
			await expect(player.locator('.cell').first()).toHaveAttribute('aria-disabled', 'true');
		}
		await black.getByLabel('Game options', { exact: true }).click();
		await black.getByRole('button', { name: 'Move history' }).click();
		await expect(black.locator('.moves li')).toHaveCount(8);
		await black.getByRole('button', { name: 'Close history' }).click();
		await black.getByLabel('Game options', { exact: true }).click();
		await black.getByRole('button', { name: 'Export game', exact: true }).click();
		await expect(black.getByRole('textbox', { name: '4D PGN notation' })).toBeVisible();
		await expect
			.poll(() => black.getByRole('textbox', { name: '4D PGN notation' }).inputValue())
			.toContain('1/2-1/2');
		await black.getByRole('button', { name: 'Close export' }).click();
		await black.reload();
		await expect(black.getByRole('heading', { name: 'Game drawn' })).toBeVisible();
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
	await expect(page.getByRole('heading', { name: 'White to move', exact: true })).toBeVisible();
	const before = await page.evaluate(() => localStorage.getItem('fourfold-computer-v1'));
	await page.locator('[data-square="2"]').click({ button: 'right' });
	await expect(page.getByRole('region', { name: 'Threat inspection' })).toContainText(
		'Defended by:'
	);
	expect(await page.evaluate(() => localStorage.getItem('fourfold-computer-v1'))).toBe(before);
	await page.getByRole('button', { name: 'Clear inspection' }).click();
	await move(page, 0, 32);
	await expect(page.locator('[data-animation="piece"]')).toHaveCount(1);
	await expect(page.locator('[data-animation="spatial-piece"]')).toHaveCount(1);
	await expect
		.poll(() =>
			page.evaluate(() => JSON.parse(localStorage.getItem('fourfold-computer-v1')!).moves.length)
		)
		.toBe(2);
	await expect(page.getByRole('heading', { name: 'White to move', exact: true })).toBeVisible();
	await page.reload();
	await expect(page.getByRole('heading', { name: 'White to move', exact: true })).toBeVisible();
	expect(
		await page.evaluate(
			() => JSON.parse(localStorage.getItem('fourfold-computer-v1')!).moves.length
		)
	).toBe(2);
	await page.getByLabel('Game options', { exact: true }).click();
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

	await expect(page.getByRole('heading', { name: 'Black to move', exact: true })).toBeVisible();
	await expect(page.locator('[data-animation]')).toHaveCount(0);
	expect(
		await page.evaluate(
			() => JSON.parse(localStorage.getItem('fourfold-computer-v1')!).moves.length
		)
	).toBe(1);
	await page.reload();
	await expect(page.getByRole('heading', { name: 'Black to move', exact: true })).toBeVisible();
});

test('resignation requires confirmation and updates both players', async ({ browser }) => {
	const { white, black, whiteContext, blackContext } = await friends(browser);
	try {
		await white.getByLabel('Game options', { exact: true }).click();
		await white.getByRole('button', { name: 'Resign', exact: true }).click();
		await white.getByRole('button', { name: 'Keep playing' }).click();
		await expect(white.getByRole('heading', { name: 'White to move', exact: true })).toBeVisible();
		await white.getByLabel('Game options', { exact: true }).click();
		await white.getByRole('button', { name: 'Resign', exact: true }).click();
		await white.getByRole('button', { name: 'Resign match', exact: true }).click();
		await expect(white.getByRole('heading', { name: 'Black wins' })).toBeVisible();
		await expect(black.getByRole('heading', { name: 'Black wins' })).toBeVisible();
		await expect(black.getByRole('region', { name: 'Game over' })).toContainText('You won!');
		await expect(white.getByRole('region', { name: 'Game over' })).toContainText('You lost');
		await expect(white.getByText('White resigned.')).toBeVisible();
	} finally {
		await whiteContext.close();
		await blackContext.close();
	}
});

test('home creates an invitation directly for the selected Black side', async ({ page }) => {
	await page.goto(process.env.E2E_BASE_URL!);
	const white = page.getByRole('radio', { name: 'White', exact: true });
	await expect(white).toBeEnabled();
	await white.focus();
	await white.press('ArrowRight');
	await expect(page.getByRole('radio', { name: 'Black', exact: true })).toBeChecked();
	await page.getByRole('button', { name: 'Play with friend', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Waiting for your friend' })).toBeVisible();
	await expect(page.getByText('You are black. Untimed.', { exact: true })).toBeVisible();
	await expect(page.getByRole('textbox', { name: 'Invitation link' })).not.toHaveValue('');
	await page.getByRole('button', { name: 'Cancel match', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Match cancelled' })).toBeVisible();
});

test('practice places either color and keeps both-color threat arrows until a board click', async ({
	page
}) => {
	await page.goto(new URL('/how-to-play', process.env.E2E_BASE_URL!).href);
	await expect(page.getByRole('button', { name: 'Show move', exact: true })).toBeEnabled();
	await page.getByRole('button', { name: 'Free practice', exact: true }).click();
	await page.getByRole('button', { name: 'Add piece', exact: true }).click();
	const white = page.getByRole('radio', { name: 'White', exact: true });
	await white.focus();
	await white.press('ArrowRight');
	await page.locator('[data-square="3"]').click();
	await expect(page.locator('[data-square="3"]')).toHaveAttribute('aria-label', /Black rook/);
	await page.getByRole('button', { name: 'Done placing', exact: true }).click();
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
	await page.getByRole('button', { name: 'Add piece', exact: true }).click();
	await page.getByRole('combobox', { name: 'Piece', exact: true }).selectOption('n');
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
