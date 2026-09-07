/**
 * IUGR deck verify matrix at 375×667 against a live URL.
 * Requires Playwright, e.g.:
 *   npm install -D playwright && npx playwright install chromium
 * Usage: node scripts/iugr-deck-verify.mjs [url]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

let chromium;
let devices;
try {
  ({ chromium, devices } = await import("playwright"));
} catch {
  console.error(
    "Missing playwright. Run: npm install -D playwright && npx playwright install chromium",
  );
  process.exit(2);
}

const URL = process.argv[2] || "https://jasonos.vercel.app/iugr";
const OUT = "/tmp/iugr-verify";
mkdirSync(OUT, { recursive: true });

const results = [];
function pass(name, detail = "") {
  results.push({ ok: true, name, detail });
  console.log(`PASS  ${name}${detail ? " — " + detail : ""}`);
}
function fail(name, detail = "") {
  results.push({ ok: false, name, detail });
  console.log(`FAIL  ${name}${detail ? " — " + detail : ""}`);
}

async function cardId(page) {
  return page.locator("[data-card-id]").first().getAttribute("data-card-id");
}

async function advance(page) {
  await page.locator(".zone-right").click({ force: true });
  await page.waitForTimeout(100);
}

async function back(page) {
  await page.locator(".zone-left").click({ force: true });
  await page.waitForTimeout(100);
}

async function overflowReport(page) {
  return page.evaluate(() => {
    const root = document.querySelector(".iugr-deck-root") || document.body;
    const card = document.querySelector(".iugr-deck-card");
    const body = document.querySelector(".iugr-deck-body");
    const issues = [];
    for (const el of [root, card, body]) {
      if (!el) continue;
      const overflowY = el.scrollHeight - el.clientHeight;
      const overflowX = el.scrollWidth - el.clientWidth;
      if (overflowY > 2 || overflowX > 2) {
        issues.push({
          cls: el.className?.toString?.().slice(0, 80) || el.tagName,
          overflowY,
          overflowX,
          scrollH: el.scrollHeight,
          clientH: el.clientHeight,
        });
      }
    }
    return {
      cardId: card?.getAttribute("data-card-id"),
      issues,
    };
  });
}

async function clearStorage(page) {
  await page.evaluate(() => {
    localStorage.removeItem("iugr-deck-v2");
    localStorage.removeItem("iugr-preferences");
  });
}

async function patchStorage(page, patch) {
  await page.evaluate((p) => {
    const raw = localStorage.getItem("iugr-deck-v2");
    const data = raw ? JSON.parse(raw) : {};
    Object.assign(data, p);
    localStorage.setItem("iugr-deck-v2", JSON.stringify(data));
  }, patch);
}

async function pickResident(page, index) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const n = await page.evaluate(
      () => document.querySelectorAll(".iugr-town-resident-btn").length,
    );
    if (n <= index) {
      await page.waitForTimeout(150);
      continue;
    }
    await page.evaluate((i) => {
      const btn = document.querySelectorAll(".iugr-town-resident-btn")[i];
      btn?.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          view: window,
        }),
      );
    }, index);
    try {
      await page.waitForFunction(
        (expected) => {
          try {
            return (
              JSON.parse(localStorage.getItem("iugr-deck-v2") || "{}")
                .readerFigureIndex === expected
            );
          } catch {
            return false;
          }
        },
        index,
        { timeout: 2000 },
      );
      return true;
    } catch {
      await page.waitForTimeout(100);
    }
  }
  return false;
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  ...devices["iPhone SE"],
  viewport: { width: 375, height: 667 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();
const consoleErrors = [];
page.on("pageerror", (e) => consoleErrors.push(String(e)));
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});

try {
  await page.goto(URL, { waitUntil: "networkidle", timeout: 60000 });
  await clearStorage(page);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector("[data-card-id]", { timeout: 15000 });

  const first = await cardId(page);
  if (first === "open-section") pass("starts on open-section");
  else fail("starts on open-section", `got ${first}`);

  let guard = 0;
  while ((await cardId(page)) !== "town-pick" && guard++ < 20) {
    const id = await cardId(page);
    const ov = await overflowReport(page);
    if (ov.issues.length) fail(`clip ${id}`, JSON.stringify(ov.issues));
    else pass(`fit ${id}`);
    await page.screenshot({
      path: join(OUT, `${String(guard).padStart(2, "0")}-${id}.png`),
    });
    if (await page.locator(".zone-right").isDisabled())
      fail(`advance blocked early on ${id}`);
    await advance(page);
  }

  // --- PICK ---
  {
    const id = await cardId(page);
    if (id !== "town-pick") fail("reach town-pick", `got ${id}`);
    else pass("reach town-pick");

    await page.waitForSelector(".iugr-town-resident-btn", {
      timeout: 10000,
      state: "attached",
    });
    const n = await page.locator(".iugr-town-resident-btn").count();
    if (n >= 50) pass("pick: grid has many buttons", String(n));
    else fail("pick: grid has many buttons", String(n));

    if (await page.locator(".zone-right").isDisabled())
      pass("pick: right zone blocked before pick");
    else fail("pick: right zone blocked before pick");

    // Do not force-click the zone center: with pointer-events:none the
    // coordinates hit a resident underneath and accidentally pick one.
    const idxBefore = await cardId(page);
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(80);
    if ((await cardId(page)) === idxBefore)
      pass("pick: ArrowRight blocked before pick");
    else fail("pick: ArrowRight blocked before pick", await cardId(page));

    if (!(await pickResident(page, 12))) fail("pick: tap resident");
    else pass("pick: tap resident");

    if (!(await page.locator(".zone-right").isDisabled()))
      pass("pick: right unlocks after tap");
    else fail("pick: right unlocks after tap");

    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(120);
    const afterKey = await cardId(page);
    if (afterKey !== "town-pick") pass("pick: ArrowRight advances", afterKey);
    else fail("pick: ArrowRight advances");

    await back(page);
    if ((await cardId(page)) === "town-pick") pass("back to town-pick");
    else fail("back to town-pick", await cardId(page));

    // Already picked — right should still be unlocked; advance.
    if (!(await page.locator(".zone-right").isDisabled()))
      pass("pick: still unlocked on revisit");
    else fail("pick: still unlocked on revisit");
    await advance(page);
  }

  // Walk to q-choose
  guard = 0;
  while ((await cardId(page)) !== "q-choose" && guard++ < 20) {
    const id = await cardId(page);
    const ov = await overflowReport(page);
    if (ov.issues.length) fail(`clip ${id}`, JSON.stringify(ov.issues));
    else pass(`fit ${id}`);
    if (await page.locator(".zone-right").isDisabled()) {
      fail(`stuck blocked on ${id}`);
      break;
    }
    await advance(page);
  }

  // --- CHOOSE (question) ---
  {
    const id = await cardId(page);
    if (id !== "q-choose") fail("reach q-choose", `got ${id}`);
    else pass("reach q-choose");

    if (await page.locator(".zone-right").isDisabled())
      pass("choose: right blocked before choice");
    else fail("choose: right blocked before choice");

    const opts = page.locator(".iugr-deck-choose-btn");
    const n = await opts.count();
    if (n >= 3) pass("choose: three options", String(n));
    else fail("choose: three options", String(n));

    await opts.nth(1).click(); // unsure
    await page.waitForTimeout(150);
    await page.waitForSelector(".iugr-deck-consequence", { timeout: 5000 });
    const consequence = await page.locator(".iugr-deck-consequence").innerText();
    if (/Fair\. Nobody has settled|carry the question/i.test(consequence))
      pass("choose: consequence on same card");
    else fail("choose: consequence on same card", consequence.slice(0, 160));

    if (!(await page.locator(".zone-right").isDisabled()))
      pass("choose: right unlocks after choice");
    else fail("choose: right unlocks after choice");

    await advance(page);
  }

  // Walk to cm-pull
  guard = 0;
  while ((await cardId(page)) !== "cm-pull" && guard++ < 30) {
    const id = await cardId(page);
    const ov = await overflowReport(page);
    if (ov.issues.length) fail(`clip ${id}`, JSON.stringify(ov.issues));
    else pass(`fit ${id}`);
    if (await page.locator(".zone-right").isDisabled()) {
      const choose = page.locator(".iugr-deck-choose-btn");
      if (await choose.count()) {
        await choose.first().click();
        await page.waitForTimeout(100);
      } else {
        fail(`cannot advance past ${id}`);
        break;
      }
    }
    if (!(await page.locator(".zone-right").isDisabled())) await advance(page);
  }

  // --- PULL ---
  {
    const id = await cardId(page);
    if (id !== "cm-pull") fail("reach cm-pull", `got ${id}`);
    else pass("reach cm-pull");

    if (await page.locator(".zone-right").isDisabled())
      pass("pull: right blocked at 0");
    else fail("pull: right blocked at 0");

    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(50);
    if ((await cardId(page)) === "cm-pull") pass("pull: ArrowRight stays on card");
    else fail("pull: ArrowRight stays on card");

    const lever = page.locator(".iugr-deck-lever-arm").first();
    await lever.waitFor({ state: "visible", timeout: 10000 });
    const box = await lever.boundingBox();
    if (box && box.width >= 110 && box.height >= 150)
      pass(
        "pull: hit area ≥110×150",
        `${Math.round(box.width)}×${Math.round(box.height)}`,
      );
    else
      fail(
        "pull: hit area ≥110×150",
        box ? `${Math.round(box.width)}×${Math.round(box.height)}` : "no box",
      );

    // 4 pulls: 0→1→9→99→999
    for (let i = 0; i < 4; i++) {
      await lever.click();
      await page.waitForTimeout(750);
    }

    let countText = await page
      .locator(".iugr-deck-count-value.is-coral")
      .first()
      .innerText()
      .catch(() => "");
    if (!/99,?900/.test(countText)) {
      await page.waitForTimeout(900);
      countText = await page
        .locator(".iugr-deck-count-value.is-coral")
        .first()
        .innerText()
        .catch(() => "");
    }
    if (/99,?900/.test(countText)) pass("pull: count reaches 99,900", countText);
    else fail("pull: count reaches 99,900", `got "${countText}"`);

    if (!(await page.locator(".zone-right").isDisabled()))
      pass("pull: right unlocked after ≥9");
    else fail("pull: right unlocked after ≥9");

    // At copies=1, right still blocked
    await patchStorage(page, { copiedTowns: 1 });
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector('[data-card-id="cm-pull"]');
    if (await page.locator(".zone-right").isDisabled())
      pass("pull: still blocked at copies=1");
    else fail("pull: still blocked at copies=1");

    await page.locator(".iugr-deck-lever-arm").first().click();
    await page.waitForTimeout(750);
    if (!(await page.locator(".zone-right").isDisabled()))
      pass("pull: unlocks at 9");
    else fail("pull: unlocks at 9");

    await patchStorage(page, { copiedTowns: 999 });
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector('[data-card-id="cm-pull"]');
    await advance(page);
  }

  // Mid-deck resume
  {
    await patchStorage(page, { index: 25 });
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector("[data-card-id]");
    const id = await cardId(page);
    const idx = await page.evaluate(() => {
      try {
        return JSON.parse(localStorage.getItem("iugr-deck-v2") || "{}").index;
      } catch {
        return null;
      }
    });
    if (idx === 25) pass("resume: storage index 25", id);
    else fail("resume: storage index 25", String(idx));
  }

  // Walk remaining deck from index 25
  {
    let steps = 0;
    const clipFails = [];
    while (steps++ < 80) {
      const id = await cardId(page);
      const ov = await overflowReport(page);
      if (ov.issues.length) clipFails.push({ id, issues: ov.issues });

      const storageIndex = await page.evaluate(() => {
        try {
          return JSON.parse(localStorage.getItem("iugr-deck-v2") || "{}").index;
        } catch {
          return -1;
        }
      });

      const right = page.locator(".zone-right");
      if (await right.isDisabled()) {
        // Last card disables right zone; closing actions share choose-btn class.
        if (storageIndex >= 69) {
          pass("reached end of deck", id);
          break;
        }
        const chooseInteractive = page.locator(
          ".iugr-deck-choose .iugr-deck-choose-btn:not(:disabled)",
        );
        const lever = page.locator(".iugr-deck-lever-arm:not(:disabled)");
        const pick = page.locator(".iugr-town-resident-btn");
        if (await chooseInteractive.count()) {
          await chooseInteractive.first().click();
          await page.waitForTimeout(120);
          if (id === "doors-choose") {
            const text = await page.locator(".iugr-deck-body").innerText();
            if (/Recorded|no wrong answer/i.test(text))
              pass("doors-choose: consequence on same card");
            else
              fail(
                "doors-choose: consequence on same card",
                text.slice(0, 100),
              );
          }
        } else if (await lever.count()) {
          await lever.first().click();
          await page.waitForTimeout(750);
        } else if (await pick.count()) {
          await pickResident(page, 5);
        } else {
          fail(`stuck on ${id} with no interaction`);
          break;
        }
      }

      if (await right.isDisabled()) {
        const lever = page.locator(".iugr-deck-lever-arm:not(:disabled)");
        if (await lever.count()) {
          await lever.first().click();
          await page.waitForTimeout(750);
          continue;
        }
      }

      const storageIndexAfter = await page.evaluate(() => {
        try {
          return JSON.parse(localStorage.getItem("iugr-deck-v2") || "{}").index;
        } catch {
          return -1;
        }
      });

      if ((await right.isDisabled()) && storageIndexAfter >= 69) {
        pass("reached end of deck", id);
        break;
      }

      if (!(await right.isDisabled())) {
        await advance(page);
      } else {
        fail(`cannot leave ${id}`);
        break;
      }
    }
    if (clipFails.length === 0) pass("full walk: no overflow clips");
    else {
      for (const c of clipFails.slice(0, 15))
        fail(`clip ${c.id}`, JSON.stringify(c.issues));
      if (clipFails.length > 15)
        fail(`clip … +${clipFails.length - 15} more`);
    }
  }

  // Back through deck
  {
    await patchStorage(page, { index: 69 });
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector("[data-card-id]");
    let hops = 0;
    while ((await cardId(page)) !== "open-section" && hops++ < 80) {
      await back(page);
    }
    if ((await cardId(page)) === "open-section")
      pass("left zone: back to first card");
    else fail("left zone: back to first card", await cardId(page));
  }

  // reduced motion
  {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await clearStorage(page);
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector(".iugr-deck-root");
    // prefs hydrate from system after effect
    await page.waitForTimeout(300);
    const attr = await page
      .locator(".iugr-deck-root")
      .getAttribute("data-reduced-motion");
    if (attr === "true") pass("prefers-reduced-motion honored");
    else fail("prefers-reduced-motion honored", String(attr));
  }

  const hydrations = consoleErrors.filter((e) =>
    /hydration|Hydration|Maximum update/i.test(e),
  );
  const real = consoleErrors.filter(
    (e) =>
      !/favicon|Download the React DevTools|Third-party cookie/i.test(e) &&
      !/hydration|Hydration/i.test(e),
  );
  if (hydrations.length === 0) pass("no hydrate/max-update errors");
  else fail("no hydrate/max-update errors", hydrations.slice(0, 2).join(" | "));
  if (real.length === 0) pass("no console errors");
  else fail("no console errors", real.slice(0, 5).join(" | "));

  await page.screenshot({ path: join(OUT, "final.png"), fullPage: false });
} catch (err) {
  fail("runner crashed", String(err));
  try {
    await page.screenshot({ path: join(OUT, "crash.png") });
  } catch {
    /* ignore */
  }
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
writeFileSync(
  join(OUT, "results.json"),
  JSON.stringify({ url: URL, failed: failed.length, results }, null, 2),
);
console.log("\n---");
console.log(
  `Total ${results.length}  PASS ${results.length - failed.length}  FAIL ${failed.length}`,
);
process.exit(failed.length ? 1 : 0);
