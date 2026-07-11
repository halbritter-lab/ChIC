import { expect, test } from '@playwright/test';

/**
 * Seeded monkey test: a deterministic pseudo-random walk over the app's whole
 * interactive surface (form entry incl. junk values, row select/edit/delete,
 * grouping, theme, reset, mixed imports, all three export formats). The seed is
 * fixed so a failure replays the exact same action sequence. The invariant under
 * test is coarse but strong: no action sequence may throw a runtime error or
 * wedge the app.
 */

// mulberry32 — tiny deterministic PRNG, plenty for action selection.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Fixed default seed for reproducibility (PR #45); override with MONKEY_SEED=n
// to explore other walks locally.
const SEED = Number(process.env.MONKEY_SEED ?? 45);
const ACTIONS_PER_RUN = 60;

test('seeded monkey walk causes no runtime errors and leaves the app usable', async ({ page }) => {
  test.setTimeout(120000);
  const rand = mulberry32(SEED);
  const pick = (options) => options[Math.floor(rand() * options.length)];

  const runtimeErrors = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));

  await page.goto('?acknowledgeBanner=true');

  const importRows = async (name, rows) => {
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Load Data', exact: true }).click();
    await (
      await chooser
    ).setFiles({
      name,
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(rows)),
    });
  };

  let monkeyId = 0;
  const idPool = () => [`m${monkeyId++}`, '007', 'x y', ''];
  const agePool = ['40', '55', '0', '120', '-5', 'abc', ' '];
  const heightPool = ['1.7', '1,75', '3.5', '0.1', ''];
  const tlvPool = ['3400', '15000', '99', 'junk', '   '];

  const actions = {
    fillAndCalculate: async () => {
      await page.locator('#idInput').fill(pick(idPool()));
      await page.locator('#ageInput').fill(pick(agePool));
      await page.locator('#heightInput').fill(pick(heightPool));
      await page.locator('#liverInput').fill(pick(tlvPool));
      // Calculate is legitimately disabled while the form holds invalid values —
      // the fill itself already exercised the validation path, so only click when
      // the app offers the action.
      const calculate = page.getByRole('button', { name: 'Calculate' });
      if (await calculate.isEnabled()) await calculate.click();
    },
    clickRow: async () => {
      const rows = page.locator('tbody tr');
      const count = await rows.count();
      if (count > 0) await rows.nth(Math.floor(rand() * count)).click();
    },
    removeRow: async () => {
      const buttons = page.locator('tbody tr button[aria-label="Remove data point"]');
      const count = await buttons.count();
      if (count > 0) await buttons.nth(Math.floor(rand() * count)).click();
    },
    toggleGrouping: async () => {
      await page.getByRole('button', { name: /(Enable|Disable) Grouping/ }).click();
    },
    toggleTheme: async () => {
      await page.locator('button[title^="Switch to"]').click();
    },
    reset: async () => {
      await page.getByTitle('Reset Form').click();
    },
    importMixed: async () => {
      await importRows(`monkey-${monkeyId++}.json`, [
        { id: `ok-${monkeyId}`, age: 40, height: 1.7, tlv: 3400 },
        { id: `na-${monkeyId}`, age: 40, tlv: 3400 },
        { id: `grp-${monkeyId}`, age: 50, height: 1.8, tlv: 5000, group: 'G', groupColor: 'red' },
        null,
        { age: 60, height: 1.6, tlv: 2000 },
      ]);
    },
    exportData: async () => {
      const toggle = page.getByRole('button', { name: 'Download Data' });
      if (!(await toggle.isEnabled())) return;
      await toggle.click();
      const menu = page.locator('.download-menu .menu-item');
      if ((await menu.count()) === 0) return; // second click closed the menu
      const download = page.waitForEvent('download', { timeout: 15000 });
      await menu.nth(Math.floor(rand() * 3)).click();
      await download;
    },
  };

  const names = Object.keys(actions);
  const trail = [];
  for (let i = 0; i < ACTIONS_PER_RUN; i++) {
    const name = pick(names);
    trail.push(name);
    await actions[name]();
    if (runtimeErrors.length > 0) break; // fail fast with the shortest trail
  }

  expect(runtimeErrors, `action trail: ${trail.join(' → ')}`).toEqual([]);

  // The app must still be fully usable after the walk: reset, add a row, see it.
  await page.getByTitle('Reset Form').click();
  await page.locator('#idInput').fill('after-monkey');
  await page.locator('#ageInput').fill('45');
  await page.locator('#heightInput').fill('1.75');
  await page.locator('#liverInput').fill('3500');
  await page.getByRole('button', { name: 'Calculate' }).click();
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody tr')).toContainText('after-monkey');
  expect(runtimeErrors).toEqual([]);
});
