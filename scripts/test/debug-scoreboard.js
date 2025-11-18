const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto('http://localhost:5173');

  // Wait for the app to load
  await page.waitForTimeout(3000);

  // Check if scoreboard exists
  const scoreboard = await page.locator('.scoreboard').count();
  console.log('Scoreboard found:', scoreboard > 0);

  // Get scoreboard content
  if (scoreboard > 0) {
    const scoreboardText = await page.locator('.scoreboard').textContent();
    console.log('Scoreboard content:', scoreboardText);
  }

  // Check game state in the store
  const gameState = await page.evaluate(() => {
    // Access the Zustand store
    const state = window.__ZUSTAND_STORE__ || {};
    return {
      score: state.gameState?.score,
      planesCleared: state.gameState?.planesCleared,
      crashCount: state.gameState?.crashCount,
      gameTime: state.gameState?.gameTime,
      nextBonusAt: state.gameState?.nextBonusAt,
    };
  });

  console.log('Game state from store:', gameState);

  // Wait a bit more for debugging
  await page.waitForTimeout(5000);

  await browser.close();
})();
