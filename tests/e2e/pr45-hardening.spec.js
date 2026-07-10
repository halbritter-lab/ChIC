import { expect, test } from '@playwright/test';
import { statSync } from 'node:fs';

test('dist server rejects missing assets and traversal while serving SPA navigation', async ({
  request,
}) => {
  const missingAsset = await request.get('assets/missing.js', {
    headers: { accept: 'text/javascript' },
  });
  expect(missingAsset.status()).toBe(404);

  const traversal = await request.get('%2e%2e%2fpackage.json', {
    headers: { accept: 'text/html' },
  });
  expect(traversal.status()).toBe(404);

  const spaNavigation = await request.get('unknown-route', {
    headers: { accept: 'text/html' },
  });
  expect(spaNavigation.status()).toBe(200);
  expect(spaNavigation.headers()['content-type']).toContain('text/html');
});

test('query inputs calculate and public report URL contains no patient context', async ({
  page,
}) => {
  await page.goto(
    '?patientId=SECRET-123&age=50&height=1.75&tlv=15000&acknowledgeBanner=true&showCitation=false'
  );
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody tr')).toContainText('SECRET-123');
  const report = await page.getByRole('link', { name: 'Report a bug' }).getAttribute('href');
  expect(report).toContain('version=0.5.5');
  expect(report).toContain('showCitation%3Dfalse');
  expect(report).not.toMatch(/SECRET-123|patientId|age%3D50|height%3D1\.75|tlv%3D15000/);
});

test('whitespace TLV does not calculate or show a spurious error', async ({ page }) => {
  await page.goto('?patientId=p1&age=50&height=1.75&tlv=%20%20&acknowledgeBanner=true');
  await expect(page.locator('tbody tr')).toHaveCount(0);
  await expect(page.locator('#liverInput')).toHaveValue('');
  await expect(page.getByText('Please correct the errors before calculating')).toHaveCount(0);
});

test('selected-point ring follows logical rows and clears on deletion', async ({ page }) => {
  await page.goto('?acknowledgeBanner=true');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Load Data', exact: true }).click();
  await (
    await chooser
  ).setFiles({
    name: 'points.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify([
        { id: 'a', age: 40, height: 1.7, tlv: 3400 },
        { id: 'b', age: 50, height: 1.8, tlv: 3600 },
        { id: 'c', age: 60, height: 1.9, tlv: 3800 },
      ])
    ),
  });
  const rows = page.locator('tbody tr');
  await expect(rows).toHaveCount(3);
  await rows.nth(2).click();
  await expect(page.locator('.ring-overlay circle')).toHaveCount(1);
  await rows.nth(0).locator('button[aria-label="Remove data point"]').click();
  await expect(page.locator('tbody tr.row-editing')).toContainText('c');
  await page.locator('tbody tr.row-editing button[aria-label="Remove data point"]').click();
  await expect(page.locator('.ring-overlay circle')).toHaveCount(0);
});

test('mixed and empty JSON imports report exact outcomes without stale replacement', async ({
  page,
}) => {
  await page.goto('?acknowledgeBanner=true');
  const load = async (name, data) => {
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Load Data', exact: true }).click();
    await (
      await chooser
    ).setFiles({
      name,
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(data)),
    });
  };
  await load('mixed.json', [
    { id: 'ok', age: 40, height: 1.7, tlv: 3400 },
    { id: 'missing-height', age: 40, tlv: 3400 },
    null,
    'junk',
    { age: 40, height: 1.7, tlv: 3400 },
  ]);
  await expect(page.locator('tbody tr')).toHaveCount(2);
  await expect(page.locator('.load-notice')).toContainText('2 malformed rows skipped');
  await expect(page.locator('.load-notice')).toContainText('1 row skipped (missing or blank ID)');
  await load('empty.json', []);
  await expect(page.locator('tbody tr')).toHaveCount(2);
  await expect(page.locator('.validation-message')).toContainText(
    'No rows found — nothing imported.'
  );
});

test('chart, downloads, core offline, and Excel cache-on-first-use work', async ({
  page,
  context,
}, testInfo) => {
  const runtimeErrors = [];
  const requestErrors = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('requestfailed', (request) =>
    requestErrors.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText}`)
  );

  await page.goto('?patientId=visual&age=50&height=1.75&tlv=15000&acknowledgeBanner=true');
  const canvas = page.locator('.chart-container canvas');
  await expect(canvas).toBeVisible();
  const dimensions = await canvas.evaluate((element) => ({
    width: element.width,
    height: element.height,
  }));
  expect(dimensions.width).toBeGreaterThan(0);
  expect(dimensions.height).toBeGreaterThan(0);
  await testInfo.attach('chart', {
    body: await page.locator('.chart-container').screenshot(),
    contentType: 'image/png',
  });

  await page.getByTitle('Switch to Dark Theme').click();
  await expect(page.locator('body')).toHaveClass(/dark-theme/);

  const plotDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download Plot' }).click();
  const plot = await plotDownload;
  expect(plot.suggestedFilename()).toMatch(/\.png$/);
  const plotPath = testInfo.outputPath(plot.suggestedFilename());
  await plot.saveAs(plotPath);
  expect(statSync(plotPath).size).toBeGreaterThan(0);

  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByTitle('How to Use & FAQ').click();
  const onlineExcelDownload = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Excel', exact: true }).click();
  expect((await onlineExcelDownload).suggestedFilename()).toBe('batch_upload_template.xlsx');
  await expect
    .poll(() => page.evaluate(async () => (await caches.keys()).includes('chic-excel')), {
      timeout: 10000,
    })
    .toBe(true);

  await context.setOffline(true);
  const offlinePage = await context.newPage();
  offlinePage.on('pageerror', (error) => runtimeErrors.push(error.message));
  offlinePage.on('requestfailed', (request) =>
    requestErrors.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText}`)
  );
  await offlinePage.goto('?acknowledgeBanner=true', { waitUntil: 'domcontentloaded' });
  await expect(offlinePage).toHaveTitle(/ChIC/);
  await expect(offlinePage.getByRole('button', { name: 'Calculate' })).toBeVisible();
  await expect(offlinePage.locator('.chart-container canvas')).toBeVisible();
  await expect(offlinePage.getByRole('link', { name: 'Report a bug' })).toBeVisible();

  await offlinePage.getByTitle('How to Use & FAQ').click();
  const offlineExcelDownload = offlinePage.waitForEvent('download');
  await offlinePage.getByRole('link', { name: 'Excel', exact: true }).click();
  expect((await offlineExcelDownload).suggestedFilename()).toBe('batch_upload_template.xlsx');
  expect(runtimeErrors).toEqual([]);
  const optionalFooterLogo = /\/(?:CeRKiD_|dfg_logo_|Heisenberg-Programm_)/;
  expect(requestErrors.filter((error) => !optionalFooterLogo.test(error))).toEqual([]);
});
