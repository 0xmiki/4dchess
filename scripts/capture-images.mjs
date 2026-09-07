import { chromium } from 'playwright';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const site = process.env.CAPTURE_URL ?? 'http://localhost:5173';
const browser = await chromium.launch({
	...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
		? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
		: {})
});
try {
	const page = await browser.newPage({
		viewport: { width: 1680, height: 1080 },
		deviceScaleFactor: 1
	});
	await page.emulateMedia({ reducedMotion: 'reduce' });
	// A fresh local computer game leaves every piece on its starting square.
	await page.goto(new URL('/computer', site).href);
	await page.getByLabel('White to move', { exact: true }).waitFor();
	const tesseract = page.locator('.space-svg');
	await tesseract.press('ArrowLeft');
	await tesseract.press('ArrowDown');
	await tesseract.evaluate((element) => element.blur());
	await page.locator('.spatial .piece').first().waitFor();
	if ((await page.locator('.spatial .piece').count()) !== 20)
		throw new Error('Expected all starting pieces.');
	await page.evaluate(() => document.fonts.ready);
	await mkdir(new URL('docs/images/', root), { recursive: true });
	await page.setViewportSize({ width: 1400, height: 760 });
	await page.evaluate(() => {
		const boards = [...document.querySelectorAll('.slice-grid .board')].map((board) =>
			board.cloneNode(true)
		);
		const spatial = document.querySelector('.spatial').cloneNode(true);
		spatial.querySelector('.caption')?.remove();
		spatial.querySelector('.space-svg .axis-gizmo')?.remove();
		const grid = document.createElement('div');
		grid.className = 'readme-boards';
		grid.append(...boards);
		const card = document.createElement('main');
		card.className = 'readme-card';
		card.append(grid, spatial);
		const style = document.createElement('style');
		style.textContent = `
			body { margin: 0; background: #171717; }
			.readme-card { width: 1400px; height: 760px; padding: 70px 48px; display: grid; grid-template-columns: 620px 620px; gap: 64px; align-items: center; }
			.readme-boards { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; }
			.readme-boards .board { border: 0; }
			.readme-card .spatial { width: 620px; height: 620px; }
			.readme-card .space-svg { width: 620px; height: 620px; }
		`;
		document.head.append(style);
		document.body.replaceChildren(card);
		const svg = spatial.querySelector('.space-svg');
		const bounds = svg.getBBox();
		const side = Math.max(bounds.width, bounds.height) + 24;
		svg.setAttribute(
			'viewBox',
			[
				bounds.x + bounds.width / 2 - side / 2,
				bounds.y + bounds.height / 2 - side / 2,
				side,
				side
			].join(' ')
		);
	});
	await page.screenshot({ path: fileURLToPath(new URL('docs/images/game.png', root)) });

	const logo = await readFile(new URL('src/lib/assets/logo.svg', root), 'utf8');
	await page.setViewportSize({ width: 1200, height: 630 });
	await page.evaluate((logo) => {
		const spatial = document.querySelector('.spatial').cloneNode(true);
		spatial.querySelector('.caption')?.remove();
		// The social image uses the game's rendered geometry and pieces, without control annotations.
		spatial.querySelector('.space-svg .axis-gizmo')?.remove();
		spatial.classList.add('social-tesseract');
		spatial.querySelector('.space-svg').setAttribute('viewBox', '0 0 440 440');
		const card = document.createElement('main');
		card.className = 'social-card';
		card.innerHTML = `<div class="social-mark">${logo}</div>`;
		card.append(spatial);
		const style = document.createElement('style');
		style.textContent = `
			body { margin: 0; background: #171717; }
			.social-card { position: relative; width: 1200px; height: 630px; overflow: hidden; color: #f3f3f3; }
			.social-mark { position: absolute; left: 80px; top: 259px; }
			.social-mark svg { display: block; width: 470px; height: auto; }

			.social-tesseract { position: absolute; left: 580px; top: 20px; width: 600px; height: 600px; }
			.social-tesseract .space-svg { width: 600px; height: 600px; }
		`;
		document.head.append(style);
		document.body.replaceChildren(card);
	}, logo);
	await page.evaluate(() => document.fonts.ready);
	await page.screenshot({ path: fileURLToPath(new URL('static/social-preview.png', root)) });
	console.log('Captured the game screenshot and social preview from the actual board renderer.');
} finally {
	await browser.close();
}
