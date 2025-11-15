import { chromium } from 'playwright';

(async () => {
  console.log('🚀 Starting scoreboard test...\n');

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // Navigate to the app
  console.log('📍 Navigating to http://localhost:5173');
  await page.goto('http://localhost:5173');

  // Wait for the app to load and connect
  await page.waitForTimeout(3000);

  // Check connection status
  const connectionStatus = await page.locator('.header').textContent();
  console.log('\n📡 Connection:', connectionStatus.includes('CONNECTED') ? '✅ CONNECTED' : '❌ NOT CONNECTED');

  // Wait a bit more for game state to sync
  await page.waitForTimeout(2000);

  // Check if scoreboard exists
  const scoreboardExists = await page.locator('.scoreboard').count() > 0;
  console.log('📊 Scoreboard exists:', scoreboardExists ? '✅ YES' : '❌ NO');

  if (scoreboardExists) {
    // Get scoreboard values
    const scoreboardText = await page.locator('.scoreboard').textContent();
    console.log('\n📈 Scoreboard Content:');
    console.log(scoreboardText);

    // Parse individual values
    const scoreMatch = scoreboardText.match(/SCORE:(\d+)/);
    const clearedMatch = scoreboardText.match(/CLEARED:(\d+)/);
    const crashesMatch = scoreboardText.match(/CRASHES:(\d+)/);
    const bonusMatch = scoreboardText.match(/NEXT BONUS:(.+?)(?=MISSION|$)/);

    console.log('\n📊 Parsed Values:');
    console.log('  Score:', scoreMatch ? scoreMatch[1] : 'NOT FOUND');
    console.log('  Cleared:', clearedMatch ? clearedMatch[1] : 'NOT FOUND');
    console.log('  Crashes:', crashesMatch ? crashesMatch[1] : 'NOT FOUND');
    console.log('  Next Bonus:', bonusMatch ? bonusMatch[1].trim() : 'NOT FOUND');
  }

  // Monitor for 10 seconds to see if values update
  console.log('\n⏱️  Monitoring for 10 seconds...');
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(1000);
    if (scoreboardExists) {
      const scoreText = await page.locator('.scoreboard').textContent();
      const scoreMatch = scoreText.match(/SCORE:(\d+)/);
      const clearedMatch = scoreText.match(/CLEARED:(\d+)/);
      const crashesMatch = scoreText.match(/CRASHES:(\d+)/);
      console.log(`  [${i+1}s] Score: ${scoreMatch?.[1] || '?'}, Cleared: ${clearedMatch?.[1] || '?'}, Crashes: ${crashesMatch?.[1] || '?'}`);
    }
  }

  console.log('\n✅ Test complete!');
  await browser.close();
})();
