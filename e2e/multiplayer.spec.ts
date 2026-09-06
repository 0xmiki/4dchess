import { test, expect, type Page, type Browser } from '@playwright/test';

test.skip(
	!process.env.E2E_BASE_URL,
	'Set E2E_BASE_URL explicitly. These checks create guest matches on its backend.'
);

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
		await black.reload();
		await expect(black.getByRole('heading', { name: 'Game drawn' })).toBeVisible();
	} finally {
		await whiteContext.close();
		await blackContext.close();
	}
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
