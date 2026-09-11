const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 800, height: 1200 } });
  
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.screenshot({ path: 'public/home.png', fullPage: true });
  
  // Clica no input e digita nome
  await page.fill('input[type="text"]', 'Camila');
  await page.screenshot({ path: 'public/nome.png', fullPage: true });
  
  // Clica em "Começar"
  await page.click('button:has-text("Começar")');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'public/pergunta1.png', fullPage: true });
  
  await browser.close();
  console.log('Screenshots criados em public/');
})().catch(console.error);
