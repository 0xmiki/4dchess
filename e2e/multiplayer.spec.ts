import { test, expect, type Page, type Browser } from '@playwright/test';

test.skip(
	!process.env.E2E_BASE_URL,
	'Set E2E_BASE_URL explicitly. These checks create guest matches on its backend.'
);

test('the dedicated guide teaches moves with linked diagrams, mistake cases, and keyboard playback', async ({
	page
}) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(process.env.E2E_BASE_URL!);
	await expect(page.getByRole('button', { name: 'Play with friend', exact: true })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Play computer', exact: true })).toBeVisible();
	await expect(page.locator('.move-explorer')).toHaveCount(0);
	await expect(page.locator('[data-square]')).toHaveCount(64);
	await page.getByRole('link', { name: 'How to play', exact: true }).click();
	await expect(page).toHaveURL(/\/how-to-play$/);
	await expect(
		page.getByRole('heading', { name: 'How to play 4D chess', exact: true })
	).toBeVisible();
	const explorer = page.locator('.move-explorer');
	await explorer.getByRole('button', { name: 'Knight', exact: true }).click();
	await expect(explorer.getByRole('button', { name: 'Knight', exact: true })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await expect(explorer.locator('.lesson-explanation')).toContainText('2 + 1');
	const slider = explorer.getByRole('slider', { name: 'Move progress', exact: true });
	await slider.focus();
	await slider.press('End');
	await expect(explorer.locator('output')).toHaveText('After');
	await explorer.getByLabel('Show a common mistake').check();
	await expect(explorer.locator('.case-label')).toHaveText('Not a legal move');
	await expect(explorer.getByRole('slider')).toBeDisabled();
	await explorer.getByLabel('Show a common mistake').uncheck();
	const projections = explorer.locator('svg.projection');
	const before = await projections.nth(1).locator('polygon').first().getAttribute('points');
	await projections.nth(0).focus();
	await projections.nth(0).press('ArrowRight');
	await expect(projections.nth(1).locator('polygon').first()).not.toHaveAttribute(
		'points',
		before!
	);
	await explorer.getByRole('button', { name: 'Reset views', exact: true }).click();
	await expect(projections.nth(1).locator('polygon').first()).toHaveAttribute('points', before!);
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
	await white.getByRole('button', { name: 'Create friend match' }).click();
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
	await page.getByRole('button', { name: 'Start game', exact: true }).click();
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
	await page.goto(new URL('/computer', process.env.E2E_BASE_URL!).href);
	await page
		.getByRole('region', { name: 'Computer game settings' })
		.getByLabel('Your side')
		.selectOption('b');
	await page.getByRole('button', { name: 'Start game', exact: true }).click();
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
		await expect(white.getByText('White resigned.')).toBeVisible();
	} finally {
		await whiteContext.close();
		await blackContext.close();
	}
});
