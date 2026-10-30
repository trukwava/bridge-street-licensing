import {test,expect,devices} from '@playwright/test';

/**
 * The CI job runs this suite against a disposable, synthetic-only DB_PATH.
 * Tests are intentionally sequential: reset is a destructive demo operation.
 */
test.describe.configure({mode:'serial'});
test.beforeEach(async ({request}) => {
 const reset=await request.post('/api/reset',{data:{}});
 expect(reset.status()).toBe(200);
});

test('daily operations dashboard is readable, data-backed and styled',async ({page})=>{
 const badResponses=[];
 page.on('response',response=>{if(response.url().includes('/atelier.css') && response.status()!==200)badResponses.push(response.status())});
 await page.goto('/');
 await expect(page.getByRole('heading',{name:/make room for precision/i})).toBeVisible();
 await expect(page.locator('.metric')).toHaveCount(5);
 await expect(page.locator('.team-member')).toHaveCount(4);
 await expect(page.getByText('14 active case files.')).toBeVisible();
 await expect(page.getByRole('link',{name:'Nonexistent'})).toHaveCount(0);
 const theme=await page.locator('.command').evaluate(el=>getComputedStyle(el).backgroundImage);
 expect(theme).toContain('gradient');
 expect(badResponses).toEqual([]);
 await page.screenshot({path:'test-results/atelier-today-desktop.png',fullPage:true,animations:'disabled'});
});

test('portfolio displays 14 active cases and opens the selected case',async ({page})=>{
 await page.goto('/');
 await page.locator('nav button[data-view="portfolio"]').click();
 await expect(page.getByRole('heading',{name:/every case, in its place/i})).toBeVisible();
 await expect(page.locator('.portfolio-lane')).toHaveCount(5);
 await expect(page.locator('.portfolio-case')).toHaveCount(14);
 await expect(page.locator('.portfolio-case-ref',{hasText:'SBP-2026-015'})).toHaveCount(0);
 await page.locator('.portfolio-case').filter({hasText:'SBP-2026-001'}).click();
 await expect(page.locator('.case-hero')).toContainText('Harbor & Pine Studio');
 await expect(page.locator('.case-hero [aria-current="step"]')).toContainText('Intake');
 await expect(page.locator('.alert')).toContainText('Proof of business address');
});

test('evidence desk routes the right deficiency into its review form',async ({page})=>{
 await page.goto('/');
 await page.locator('nav button[data-view="deficiencies"]').click();
 await expect(page.getByRole('heading',{name:/nothing unresolved goes unseen/i})).toBeVisible();
 await expect(page.locator('.triage-case')).toHaveCount(10);
 await page.locator('[data-def-filter="Response received"]').click();
 await expect(page.locator('.triage-case')).toHaveCount(0);
 await page.locator('[data-def-filter="All unresolved"]').click();
 const first=page.locator('.triage-case').filter({hasText:'SBP-2026-001'});
 await expect(first).toContainText('Proof of business address');
 await first.locator('[data-open-def]').click();
 await expect(page.locator('#dialog')).toBeVisible();
 await expect(page.locator('#dialog h2')).toHaveText('Review deficiency');
 await expect(page.locator('#f-response')).toHaveValue('');
 await page.locator('#cancel').click();
});

test('case finder uses actual application identity and keyboard shortcut',async ({page})=>{
 await page.goto('/');
 await page.keyboard.press('Control+k');
 await expect(page.locator('#caseFinder')).toBeVisible();
 await page.locator('#finderSearch').fill('SBP-2026-015');
 await expect(page.locator('.finder-result')).toHaveCount(1);
 await expect(page.locator('.finder-result')).toContainText('withdrawn');
 await page.locator('.finder-result').click();
 await expect(page.locator('.case-hero')).toContainText('SBP-2026-015');
 await expect(page.locator('#caseFinder')).not.toBeVisible();
});

test('task reassignment survives reload and leaves the prior owner in history',async ({page})=>{
 await page.goto('/');
 await page.locator('#quickFind').click();
 await page.locator('#finderSearch').fill('SBP-2026-005');
 await page.locator('.finder-result').click();
 const firstTask=page.locator('[data-edit-task]').first();
 await expect(firstTask).toBeVisible();
 await firstTask.click();
 await page.locator('#f-owner').selectOption('Morgan');
 await page.locator('#f-note').fill('Morgan takes the supporting-document review.');
 await page.getByRole('button',{name:'Save',exact:true}).click();
 await expect(page.locator('#dialog')).not.toBeVisible();
 await expect(page.locator('.timeline')).toContainText('Alex → Morgan');
 await page.reload();
 await page.locator('#quickFind').click();
 await page.locator('#finderSearch').fill('SBP-2026-005');
 await page.locator('.finder-result').click();
 await expect(page.locator('.timeline')).toContainText('Alex → Morgan');
 await expect(page.locator('.panel').filter({hasText:'Accountable tasks'}).first()).toContainText('Morgan');
});

test('mobile desk is navigable and captures a screenshot',async ({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');
 await expect(page.getByRole('heading',{name:/make room for precision/i})).toBeVisible();
 await page.screenshot({path:'test-results/atelier-today-mobile.png',fullPage:true,animations:'disabled'});
 await page.locator('nav button[data-view="portfolio"]').click();
 await expect(page.locator('.portfolio-lane')).toHaveCount(5);
 await expect(page.locator('.portfolio-board').evaluate(el=>el.scrollWidth>el.clientWidth)).resolves.toBe(true);
 await page.screenshot({path:'test-results/atelier-portfolio-mobile.png',fullPage:true,animations:'disabled'});
 await page.locator('#quickFind').click();
 await expect(page.locator('#finderSearch')).toBeFocused();
});
