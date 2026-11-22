# Mojo Dojo POS

<img src="logo.png" alt="Mojo Dojo — Enter the snack dojo." height="120">

Point of sale for Mojo Dojo, a lemonade & snacks stand.

A simple point-of-sale that runs entirely in the browser. No server, no install, no account.
Open `index.html` on a phone, tablet or laptop and start taking orders.

## What it does

- **New order**: tap menu items, add a customer name and note, then:
  - **Pay now**: Cash / GCash / Other, with a change calculator for cash
  - **Pay later**: the order is saved as *not paid*
  - **Add to tab**: charge it to a regular customer's tab
- **Orders**: every order has three status buttons you can tap: **Made**, **Paid**, **Given**.
  An order moves to *Completed* once all three are done. Orders can be cancelled or restored.
- **Tabs**: open a tab for a regular customer. They keep ordering, and you record payments
  whenever they settle, full or partial. Payments pay off the oldest orders first, so each order
  shows whether it's covered. Shows balance owed, total ordered, total paid and full history.
- **Sales**: pick a day to see orders, amount sold, money collected (by Cash/GCash), what's still
  owed on tabs, unpaid walk-in orders, and items sold.
- **Settings**: edit menu items and prices, download/restore a backup, erase data.

## Menu (default)

| Category  | Item              | Price |
|-----------|-------------------|------:|
| Food      | Classic Mojo      | ₱120 |
| Food      | Nacho Supreme     | ₱150 |
| Food      | Mochos            | ₱180 |
| Snacks    | Cheese Sticks     |  ₱50 |
| Beverages | Lemonade          |  ₱60 |
| Beverages | Yakult Lemonade   |  ₱70 |
| Beverages | Blue Sky Lemonade |  ₱80 |
| Extra Dip | Cheese Dip        |  ₱20 |
| Extra Dip | Garlic Mayo       |  ₱20 |
| Extra Dip | Chili Mayo        |  ₱15 |

## Important: where your data lives

All data is saved in the browser on the device you use (localStorage). It is **not** synced
between devices, and clearing the browser's site data erases it. Use **Settings → Download backup**
regularly. Use one device as the register.

## Hosting

It's static files (`index.html`, `styles.css`, `app.js`, plus `logo.png` and `icon.png`). You can open them directly, or host
them for free on GitHub Pages (repo Settings → Pages → deploy from branch) to get a URL you can
bookmark or "Add to Home Screen" on a phone.
