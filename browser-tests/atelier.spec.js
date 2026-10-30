import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

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

test('portfolio CSV excludes withdrawn work and neutralizes spreadsheet formulas',async ({page,request})=>{
 const app=await request.post('/api/create',{data:{client:'Synthetic pilot',business:'=SUM(1,1)',reference:'CSV-TEST-001',jurisdiction:'Fictional',owner:'Alex',priority:'Normal'}});
 expect(app.status()).toBe(200);
 await page.goto('/');
 await page.locator('nav button[data-view="portfolio"]').click();
 const pending=page.waitForEvent('download');
 await page.locator('#portfolioExport').click();
 const download=await pending;
 expect(download.suggestedFilename()).toBe('bridge-street-active-case-ledger.csv');
 const content=await readFile(await download.path(),'utf8');
 expect(content).toContain('"Reference","Business"');
 expect(content).toContain('CSV-TEST-001');
 expect(content).toContain("'=SUM(1,1)");
 expect(content).not.toContain('SBP-2026-015');
 expect(content.trim().split(/\r?\n/)).toHaveLength(16); // header + 15 active
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

test('next-action brief links to the real deficiency without inventing a deadline',async ({page})=>{
 await page.goto('/');
 await page.locator('#quickFind').click();
 await page.locator('#finderSearch').fill('SBP-2026-001');
 await page.locator('.finder-result').click();
 const brief=page.locator('.next-action-card');
 await expect(brief).toContainText('Proof of business address');
 await expect(brief).toContainText('Due: Not entered');
 await expect(brief).toContainText('Alex');
 await brief.locator('[data-next-def]').click();
 await expect(page.locator('#dialog')).toBeVisible();
 await expect(page.locator('#dialog h2')).toContainText('Review deficiency');
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

test('stale edits never overwrite newer work and offer an explicit recovery path',async ({page,request})=>{
 await page.goto('/');
 await page.locator('#quickFind').click();
 await page.locator('#finderSearch').fill('SBP-2026-005');
 await page.locator('.finder-result').click();
 await page.locator('[data-edit-task]').first().click();
 await page.locator('#f-owner').selectOption('Morgan');
 await page.locator('#f-note').fill('Unsaved handoff note to preserve');
 const snapshot=await (await request.get('/api')).json();
 const app=snapshot.apps.find(a=>a.id==='BS-005');
 const updated=await request.post('/api/reference',{data:{id:app.id,revision:app.revision,kind:'documents',label:'Concurrent addition',reference:'SYN-NEW'}});
 expect(updated.status()).toBe(200);
 await page.locator('#modalSave').click();
 await expect(page.locator('#dialog')).toBeVisible();
 await expect(page.locator('#formerror')).toContainText('Stale record');
 await expect(page.locator('#f-note')).toHaveValue('Unsaved handoff note to preserve');
 await expect(page.locator('#conflictActions')).toBeVisible();
 const latest=await (await request.get('/api')).json();
 expect(latest.apps.find(a=>a.id==='BS-005').tasks[0].owner).toBe('Alex');
 await page.locator('#reloadLatest').click();
 await expect(page.locator('#dialog')).not.toBeVisible();
 await expect(page.locator('#notice')).toContainText('Latest saved record loaded');
});

test('supervisor override enumerates real blockers and retains the deficiency',async ({page})=>{
 await page.goto('/');
 await page.locator('#quickFind').click();
 await page.locator('#finderSearch').fill('SBP-2026-001');
 await page.locator('.finder-result').click();
 await page.locator('#advance').click();
 await expect(page.locator('#dialog h2')).toContainText('Review stage advancement');
 await expect(page.locator('.override-list')).toContainText('Proof of business address');
 await page.locator('#f-reason').fill('Demo supervisor reviewed and accepted unresolved address evidence for next preparation stage');
 await page.locator('#modalSave').click();
 await expect(page.locator('#dialog')).not.toBeVisible();
 await expect(page.locator('.case-hero [aria-current="step"]')).toContainText('Preparation');
 await expect(page.locator('.alert')).toContainText('Proof of business address');
 await expect(page.locator('.timeline')).toContainText('Supervisor override');
});

test('workflow version editor creates a new template without rewriting old case snapshots',async ({page,request})=>{
 await page.goto('/');
 await page.locator('nav button[data-view="templates"]').click();
 await page.locator('#template').click();
 await expect(page.locator('#dialog h2')).toContainText('Publish workflow version 2');
 await page.locator('#tasks').fill('First required task\nSecond required task');
 await page.locator('#stage0').fill('Approved synthetic onboarding message:');
 await page.locator('#modalSave').click();
 await expect(page.locator('#dialog')).not.toBeVisible();
 await expect(page.locator('.panel').first()).toContainText('Version 2');
 const state=await (await request.get('/api')).json();
 const old=state.apps.find(a=>a.id==='BS-001');
 expect(old.templateVersion).toBe(1);
 const resp=await request.post('/api/create',{data:{client:'Pilot client',business:'Template test case',reference:'PILOT-TEMPLATE-002',jurisdiction:'Fictional',owner:'Alex',priority:'Normal'}});
 expect(resp.status()).toBe(200);
 const created=await resp.json();
 expect(created.templateVersion).toBe(2);
 const drafted=await request.post('/api/draft',{data:{id:created.id,revision:created.revision}});
 expect(drafted.status()).toBe(200);
 expect((await drafted.json()).drafts[0].body).toContain('Approved synthetic onboarding message:');
});

test('archived cases are read-only until deliberately reactivated',async ({page})=>{
 await page.goto('/');
 await page.locator('#quickFind').click();
 await page.locator('#finderSearch').fill('SBP-2026-015');
 await page.locator('.finder-result').click();
 await expect(page.locator('.alert').first()).toContainText('Read-only record');
 await expect(page.locator('#advance')).toBeDisabled();
 await expect(page.locator('#draft')).toBeDisabled();
 await expect(page.locator('[data-edit-task]').first()).toBeDisabled();
 await page.locator('#appstatus').click();
 await page.locator('#f-status').selectOption('active');
 await page.locator('#modalSave').click();
 await expect(page.locator('#advance')).toBeEnabled();
 await expect(page.locator('[data-edit-task]').first()).toBeEnabled();
});

test('mobile desk is navigable and captures a screenshot',async ({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');
 await expect(page.getByRole('heading',{name:/make room for precision/i})).toBeVisible();
 await page.screenshot({path:'test-results/atelier-today-mobile.png',fullPage:true,animations:'disabled'});
 await page.locator('nav button[data-view="portfolio"]').click();
 await expect(page.locator('.portfolio-lane')).toHaveCount(5);
 expect(await page.locator('.portfolio-board').evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(true);
 await page.screenshot({path:'test-results/atelier-portfolio-mobile.png',fullPage:true,animations:'disabled'});
 await page.locator('#quickFind').click();
 await expect(page.locator('#finderSearch')).toBeFocused();
});
