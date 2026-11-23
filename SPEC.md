# Mojo Dojo POS: full spec to recreate it

Everything needed to rebuild the app from scratch. Paste the **prompt** below into a new Claude chat with the logo image attached, or hand the whole file to a developer.

Source code: GitHub `marrazambrano-art/ledgr`, branch `claude/dazzling-gates-ezwvmv`.
Live claude.ai version: https://claude.ai/artifact/BcdZXkgXfbrGBtysKPxisR

---

## Paste-ready prompt

> Build a point-of-sale web app called **Mojo Dojo POS** for my small snacks and lemonade stand in the Philippines (prices in pesos, ₱). It must work well on a phone and a tablet. Use the attached Mojo Dojo logo. Follow the spec below exactly.
>
> *(then paste sections 1–9 below)*

---

## 1. Brand

- **Name:** Mojo Dojo. Tagline on the logo: "Enter the snack dojo."
- **Logo:** cartoon chip mascot with black headband, sunglasses, white gloves and red sneakers, above "MOJO DOJO" lettering on a red banner. Transparent PNG.
  - Files in the repo: `logo.png` (168px tall, header), `logo-large.png` (840px, lock screen), `icon.png` (180×180 on dark background, home-screen icon).
- **Colours:**
  | Use | Hex |
  |---|---|
  | Mojo yellow (main accent, active tab, primary buttons) | `#FDB913` |
  | Dojo orange (header stripe, count badges) | `#F26A1B` |
  | Banner red | `#C8302A` |
  | Ink (header background, outlines) | `#1A1208` |
  | Page background (light) | `#FFF7E8` |
  | Green (paid / done) | `#2E9B5B` |
  | Red (owes / errors) | `#C8432F` |
  | Blue (on tab) | `#2D6FB8` |
- **Fonts:** headings, order numbers, totals and keypad digits in **Lilita One** (Google Fonts). Everything else in the system font.
- **Header:** dark ink bar with a 4px orange bottom stripe. Logo on the left, then the section tabs. On the right, a sync status pill and a lock button.
- Supports light and dark mode.

## 2. Menu (default, editable in Settings)

| Category | Item | Price |
|---|---|---:|
| Food | Classic Mojo | ₱120 |
| Food | Nacho Supreme | ₱150 |
| Food | Mochos | ₱180 |
| Snacks | Cheese Sticks | ₱50 |
| Beverages | Lemonade | ₱60 |
| Beverages | Yakult Lemonade | ₱70 |
| Beverages | Blue Sky Lemonade | ₱80 |
| Extra Dip | Cheese Dip | ₱20 |
| Extra Dip | Garlic Mayo | ₱20 |
| Extra Dip | Chili Mayo | ₱15 |

## 3. Screens

Five tabs in the header: **New order · Orders · Tabs · Sales · Settings**. The Orders tab shows a badge with the number of open orders.

### New order
- Menu items appear as big tap tiles grouped by category. Tapping adds one. A small orange badge on the tile shows the quantity in the cart.
- The cart panel (on the right on desktop, below the menu on phones) has:
  - a line per item with − / + stepper and line total
  - the **Total**
  - **Customer name** (optional)
  - **Put on a tab?** dropdown: "No — pay now or later", every open tab with its current balance, and "+ Open a new tab…"
  - **Note** (optional, e.g. "less ice")
  - Buttons:
    - With no tab chosen: **Pay now** (green) and **Place order — pay later**
    - With a tab chosen: **Add to [name]'s tab** (blue)
  - **Clear order** link
- On phones, when the cart has items, a floating dark bar at the bottom shows "N items · ₱X  View order ↓" and scrolls to the cart.
- Order numbers restart at #1 each day.

### Payment dialog
- Shows the total in large type.
- Method: **Cash / GCash / Other**.
- For cash: a "Cash received" field, quick buttons for the next notes above the total (₱20/50/100/200/500/1000, up to three), and **Exact**. Shows "Change: ₱X", or "Short by ₱X" in red.
- When paying an existing unpaid order, it can also say "…or put it on a tab".

### Orders
- Filter: **Open / Completed / All**, plus a search box for name or order #.
- Open orders are listed oldest first, like a kitchen queue.
- Each order card shows:
  - #number, customer name, time, and a "Tab: name" badge if it's on a tab
  - Each item line: **one tick box per portion** (2 Mochos = 2 boxes), then "qty × name" and the line total. Tapping an empty box marks one more portion done; tapping a ticked box unmarks one. When all of a line is done, the name is greyed and crossed out.
  - The note, if any, on a yellow strip
  - Total
  - **Three status buttons:**
    1. **Made:** shows "Not made", then "3/4 Partly made" (yellow) while in progress, then "✓ Made" (green). Tapping it marks every portion done, or undoes them all if already made.
    2. **Paid:** "Not paid" → tap opens the payment dialog → "✓ Paid · Cash". Tapping a paid order asks to mark it unpaid. Tab orders show "On tab" (blue) until the tab payments cover them, then "✓ Paid". Tapping an "On tab" order jumps to that tab.
    3. **Given:** "Not given" ↔ "✓ Given".
  - **Cancel order** link (asks to confirm). Cancelled orders can be restored.
- An order is **Completed** when it is Made + Paid + Given.

### Tabs (for regular customers)
- Cards for each open tab: name, phone/note, the balance owed in big red text (or "All settled" in green), and "N orders · ₱X paid so far". Sorted by highest balance.
- **+ New tab** button: asks for name (required) and phone/note.
- Tapping a tab opens its detail:
  - Buttons: **+ New order on tab** (goes to New order with the tab preselected), **Record payment**, **Edit**
  - Stats: balance owed, total ordered, total paid, number of unpaid orders
  - History table, newest first: orders (items, note, Paid/Unpaid, Not made/Not given badges, amount) and payments (method, amount, **undo** link)
  - **Close this tab** link, shown only when the balance is zero
- **Record payment** uses the payment dialog with an editable amount (defaults to the full balance), so partial payments work. The confirmation message reads "Got ₱100 — Mang Jun still owes ₱100" or "Mang Jun's tab is fully settled 🎉".

### Sales
- A date picker (defaults to today).
- Stat tiles:
  - **Orders** that day
  - **Sold**: total of orders placed that day
  - **Money collected**: cash/GCash actually received that day, including tab payments, broken down by method
  - **Owed on tabs** (all time)
  - **Unpaid walk-in orders** (all time, with count)
- **Items sold** table: item, quantity, amount, sorted by quantity.

### Settings
- **Menu editor:** a row per item with category (with suggestions), name, price, and delete. A **+ Add item** button. Old orders keep the price they were sold at.
- **Lock & PIN:** "Lock when idle for" (1, 2, 5, 10 or 30 minutes, or Never; default 2), **Change PIN**, and (website only) **Sign out this device**.
- **Backup:** **Download backup** (JSON file `mojo-dojo-backup-YYYY-MM-DD.json`), **Restore backup** (replaces everything, after confirming), **Erase all data** (after confirming).

## 4. Lock screen and PIN

- A full-screen dark background (radial glow from brown `#3A2408` to ink) with the large logo gently bobbing and "Tap anywhere to unlock" pulsing in yellow.
- Tapping shows a smaller logo, a message line, 6 PIN dots and a round number keypad (1–9, Clear, 0, ⌫). Typing on a physical keyboard also works.
- The PIN is **6 digits**. A wrong PIN shakes the dots and shows "Wrong PIN. Try again." After 5 wrong tries it waits 30 seconds.
- It locks automatically after the idle time with no taps or keys, and also with the lock button in the header. If the keypad is opened and left alone for 30 seconds, it returns to the logo.
- **First run in device-only mode:** "Create a 6-digit PIN for this register", then "Enter the same PIN again".
- **Website with Firebase:** the PIN is the password of one shared Firebase account (`register@mojodojo.app`). Every unlock checks it online. If there's no internet, the PIN the device last signed in with is accepted.

## 5. Data model

Each record is its own document (collections `orders`, `tabs`, `tabPayments`; the menu lives in `config/menu` as `{ items: [...] }`).

```js
menuItem   { id, cat, name, price }
order      { id, no, at /*ms*/, items: [{ id, name, price, qty, done }], total,
             customer, tabId|null, note, made, given, paidAt|null, method|null, cancelled }
tab        { id, name, phone, createdAt, archived }
tabPayment { id, tabId, amount, method, at }
```

## 6. Business rules

- **Tab balance** = total of the tab's non-cancelled orders − total of its payments.
- **Which tab orders count as paid:** payments are applied to the tab's orders oldest first. An order is paid once the payments fully cover it. This is worked out each time and never stored.
- **Walk-in orders** are paid when `paidAt` is set.
- **Made** is true when every portion is ticked. Orders saved before per-portion ticks existed (no `done` field) follow their `made` flag.
- **Completed** = not cancelled + made + paid + given.
- Cancelled orders don't count toward sales or tab balances.

## 7. Saving and syncing

The app runs on one of three storage backends, picked automatically:

1. **Website + Firebase** (when `config.js` holds a Firebase config): Firestore for data with offline persistence, and Firebase Auth email/password for the PIN. Security rules only let `register@mojodojo.app` read or write (see `firestore.rules`). Setup steps are in `SETUP.md`.
2. **claude.ai artifact:** the artifact's shared database, so every device signed into the same claude.ai account shares the data.
3. **Device only:** the browser's localStorage.

All three keep live listeners on every collection, so changes from another device appear without reloading. The header pill shows **Synced / Connecting… / Offline / This device only / Signed out**. Writes to the same document go one at a time.

## 8. Hosting

- **Static files:** `index.html`, `styles.css`, `app.js`, `config.js`, logo files, `vendor/` (Firebase 10.12.2 compat SDK files: app, auth, firestore), and `.nojekyll`.
- **GitHub Pages:** repo Settings → Pages → Deploy from branch → `claude/dazzling-gates-ezwvmv`, folder `/ (root)`. The site appears at `https://marrazambrano-art.github.io/ledgr/`.
- **Cloudflare alternative:** Cloudflare Pages for the files, D1 or a Durable Object for the data, and a Worker that checks the PIN and issues a session cookie.

## 9. Quality bar

- Tap targets at least 44px. No sideways scrolling on a 390px-wide phone.
- No browser pop-ups (`alert`/`confirm`). Every confirmation is an in-page dialog.
- Toast messages at the bottom confirm actions ("Order #3 placed on Mang Jun's tab").
- Light and dark mode both readable. Respects reduced-motion settings.
