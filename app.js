/* Mojo Dojo POS — snacks & lemonade. All data lives in this browser's localStorage. */
(() => {
  'use strict';

  const STORE_KEY = 'ledgr-pos-v1';

  const DEFAULT_MENU = [
    { id: 'classic-mojo',   cat: 'Food',      name: 'Classic Mojo',     price: 120 },
    { id: 'nacho-supreme',  cat: 'Food',      name: 'Nacho Supreme',    price: 150 },
    { id: 'mochos',         cat: 'Food',      name: 'Mochos',           price: 180 },
    { id: 'cheese-sticks',  cat: 'Snacks',    name: 'Cheese Sticks',    price: 50 },
    { id: 'lemonade',       cat: 'Beverages', name: 'Lemonade',         price: 60 },
    { id: 'yakult-lemonade',cat: 'Beverages', name: 'Yakult Lemonade',  price: 70 },
    { id: 'blue-sky',       cat: 'Beverages', name: 'Blue Sky Lemonade',price: 80 },
    { id: 'cheese-dip',     cat: 'Extra Dip', name: 'Cheese Dip',       price: 20 },
    { id: 'garlic-mayo',    cat: 'Extra Dip', name: 'Garlic Mayo',      price: 20 },
    { id: 'chili-mayo',     cat: 'Extra Dip', name: 'Chili Mayo',       price: 15 },
  ];

  /* ---------- state ---------- */
  const blank = () => ({ menu: DEFAULT_MENU.map(m => ({ ...m })), orders: [], tabs: [], tabPayments: [] });
  let db = load();
  const ui = {
    view: 'order',
    cart: {},              // menuId -> qty
    orderFilter: 'active',
    selectedTab: null,
    salesDate: dayKey(new Date()),
  };

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        return { ...blank(), ...d };
      }
    } catch (e) { console.warn('Could not load data', e); }
    return blank();
  }
  function saveLocal() {
    if (remote) return;
    try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); }
    catch (e) { toast('⚠️ Could not save. Storage is full or blocked.'); }
  }

  /* ---------- shared database (when opened as a claude.ai artifact) ----------
     Each order, tab and payment is its own document, so several phones can
     ring up orders at once. Falls back to this browser's storage elsewhere. */
  let remote = null;
  const COLLS = ['orders', 'tabs', 'tabPayments'];
  const queues = {};
  const clone = o => JSON.parse(JSON.stringify(o));
  function writeFailed(e) {
    console.warn('write failed', e);
    toast(e && e.code === 'invalid_argument'
      ? 'You can view this register but not change it'
      : e && e.code === 'quota_exceeded' ? 'Storage is full. Erase old data in Settings.' : 'Could not save. Check your connection.');
  }
  // one write at a time per document
  function queueWrite(path, fn) {
    queues[path] = (queues[path] || Promise.resolve()).then(fn).catch(writeFailed);
    return queues[path];
  }
  function save(kind, obj) {
    saveLocal();
    if (!remote || !kind) return;
    if (kind === 'menu') {
      const data = { items: clone(db.menu) };
      return queueWrite('config/menu', () => remote.doc('config/menu').set(data));
    }
    const data = clone(obj);
    return queueWrite(kind + '/' + obj.id, () => remote.collection(kind).doc(obj.id).set(data));
  }
  function removeDoc(kind, id) {
    saveLocal();
    if (remote) return queueWrite(kind + '/' + id, () => remote.collection(kind).doc(id).delete());
  }
  async function replaceAll() {
    saveLocal();
    if (!remote) return;
    setSync('Saving…');
    try {
      for (const c of COLLS) {
        const snap = await remote.collection(c).get();
        const keep = new Set(db[c].map(x => x.id));
        for (const d of snap.docs) if (!keep.has(d.id)) await remote.collection(c).doc(d.id).delete();
        for (const x of db[c]) await remote.collection(c).doc(x.id).set(clone(x));
      }
      await remote.doc('config/menu').set({ items: clone(db.menu) });
      setSync('Synced');
    } catch (e) { writeFailed(e); }
  }
  function setSync(text, title) {
    const el = $('#syncState');
    el.textContent = text;
    el.title = title || '';
    el.dataset.state = text === 'Synced' ? 'ok' : text === 'This device only' ? 'local' : 'wait';
  }
  async function connect() {
    const use = window.claude && window.claude.use;
    if (!use) { setSync('This device only', 'Saved in this browser. Download backups in Settings.'); return; }
    setSync('Connecting…');
    let ns = null;
    try { ns = await window.claude.use('db'); } catch { ns = null; }
    if (!ns) { setSync('This device only', 'Saved in this browser. Sign in to sync across devices.'); return; }
    remote = ns;
    const confirmed = new Set();
    const timer = setTimeout(() => { if (confirmed.size < 4) setSync('Offline', 'Can\'t reach saved data yet. Changes will sync when back online.'); }, 10000);
    const ok = key => (snap) => {
      if (!snap.metadata.fromCache) confirmed.add(key);
      if (confirmed.size === 4) { clearTimeout(timer); setSync('Synced', 'Saved online. Open this link on any device.'); }
    };
    const fail = e => { clearTimeout(timer); setSync('Offline', e && e.message); };
    for (const c of COLLS) {
      remote.collection(c).onSnapshot(snap => {
        db[c] = snap.docs.map(d => clone(d.data()));
        ok(c)(snap);
        rerender();
      }, fail);
    }
    remote.doc('config/menu').onSnapshot(snap => {
      const items = snap.exists && snap.data().items;
      db.menu = Array.isArray(items) && items.length ? clone(items) : DEFAULT_MENU.map(m => ({ ...m }));
      ok('menu')(snap);
      rerender();
    }, fail);
  }
  let rerenderPending = false;
  function rerender() {
    if (rerenderPending) return;
    rerenderPending = true;
    requestAnimationFrame(() => {
      rerenderPending = false;
      // don't redraw the menu editor under someone's fingers
      if (ui.view === 'settings' && $('#menuEditor').contains(document.activeElement)) { renderActiveCount(); return; }
      render();
    });
  }

  /* ---------- helpers ---------- */
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const peso = n => '₱' + (Math.round(n * 100) / 100).toLocaleString('en-PH', { maximumFractionDigits: 2 });
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function dayKey(d) {
    d = new Date(d);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  const time = ts => new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const dateTime = ts => new Date(ts).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const tabById = id => db.tabs.find(t => t.id === id);

  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  /* ---------- tab accounting ----------
     A tab's balance = total of its (non-cancelled) orders − payments made.
     Payments are applied to the oldest orders first, so an order on a tab
     counts as "paid" once the payments cover it. */
  function tabLedger(tabId) {
    const orders = db.orders.filter(o => o.tabId === tabId && !o.cancelled).sort((a, b) => a.at - b.at);
    const payments = db.tabPayments.filter(p => p.tabId === tabId).sort((a, b) => a.at - b.at);
    const charged = orders.reduce((s, o) => s + o.total, 0);
    const paid = payments.reduce((s, p) => s + p.amount, 0);
    let pool = paid;
    const covered = new Set();
    for (const o of orders) {
      if (pool + 1e-9 >= o.total) { covered.add(o.id); pool -= o.total; } else break;
    }
    return { orders, payments, charged, paid, balance: charged - paid, covered };
  }
  function isPaid(o) {
    if (o.tabId) return tabLedger(o.tabId).covered.has(o.id);
    return !!o.paidAt;
  }
  const isDone = o => !o.cancelled && o.made && o.given && isPaid(o);
  /* Per-item progress: how many of each line are prepared. Older orders
     without a count follow the order's Made flag. */
  const doneCount = (o, it) => Math.min(it.qty, it.done ?? (o.made ? it.qty : 0));
  const madeProgress = o => {
    let done = 0, total = 0;
    for (const it of o.items) { done += doneCount(o, it); total += it.qty; }
    return { done, total };
  };
  function setItemDone(o, idx, n) {
    o.items.forEach((it, i) => { it.done = doneCount(o, it); });
    const it = o.items[idx];
    it.done = Math.max(0, Math.min(it.qty, n));
    o.made = o.items.every(x => x.done >= x.qty);
  }

  /* ---------- navigation ---------- */
  function show(view) {
    ui.view = view;
    $$('#nav button').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + view));
    render();
    window.scrollTo(0, 0);
  }
  $('#nav').addEventListener('click', e => {
    const b = e.target.closest('button[data-view]');
    if (b) show(b.dataset.view);
  });

  function render() {
    renderActiveCount();
    if (ui.view === 'order') renderOrderView();
    if (ui.view === 'orders') renderOrders();
    if (ui.view === 'tabs') renderTabs();
    if (ui.view === 'sales') renderSales();
    if (ui.view === 'settings') renderSettings();
  }
  function renderActiveCount() {
    const n = db.orders.filter(o => !o.cancelled && !isDone(o)).length;
    $('#activeCount').textContent = n || '';
  }

  /* ---------- NEW ORDER ---------- */
  function categories() {
    const cats = [];
    for (const m of db.menu) if (!cats.includes(m.cat)) cats.push(m.cat);
    return cats;
  }
  function renderOrderView() {
    $('#menu').innerHTML = categories().map(cat => `
      <div class="menu-cat">
        <h3>${esc(cat)}</h3>
        <div class="menu-grid">
          ${db.menu.filter(m => m.cat === cat).map(m => `
            <button class="menu-item" data-add="${esc(m.id)}">
              <span class="name">${esc(m.name)}</span>
              <span class="price">${peso(m.price)}</span>
              ${ui.cart[m.id] ? `<span class="qty">${ui.cart[m.id]}</span>` : ''}
            </button>`).join('')}
        </div>
      </div>`).join('');
    renderCart();
  }
  function cartLines() {
    return Object.entries(ui.cart)
      .map(([id, qty]) => ({ item: db.menu.find(m => m.id === id), qty }))
      .filter(l => l.item && l.qty > 0);
  }
  const cartTotal = () => cartLines().reduce((s, l) => s + l.item.price * l.qty, 0);

  function renderTabSelect(keep) {
    const sel = $('#tabSelect');
    const cur = keep ?? sel.value;
    const open = db.tabs.filter(t => !t.archived).sort((a, b) => a.name.localeCompare(b.name));
    sel.innerHTML = `<option value="">No — pay now or later</option>` +
      open.map(t => `<option value="${esc(t.id)}">${esc(t.name)} (owes ${peso(tabLedger(t.id).balance)})</option>`).join('') +
      `<option value="__new">+ Open a new tab…</option>`;
    sel.value = open.some(t => t.id === cur) ? cur : '';
  }

  function renderCart() {
    const lines = cartLines();
    $('#cartItems').innerHTML = lines.map(l => `
      <div class="cart-line">
        <span>${esc(l.item.name)}</span>
        <span class="stepper">
          <button data-dec="${esc(l.item.id)}" aria-label="Remove one">−</button>
          <span>${l.qty}</span>
          <button data-inc="${esc(l.item.id)}" aria-label="Add one">+</button>
        </span>
        <span>${peso(l.item.price * l.qty)}</span>
      </div>`).join('');
    $('#cartTotal').textContent = peso(cartTotal());
    const count = lines.reduce((s, l) => s + l.qty, 0);
    $('#view-order').classList.toggle('has-items', count > 0);
    $('#cartBarText').textContent = `${count} item${count === 1 ? '' : 's'} · ${peso(cartTotal())}`;
    renderTabSelect();
    renderCartActions();
  }
  function renderCartActions() {
    const empty = cartLines().length === 0;
    const tabId = $('#tabSelect').value;
    $('#cartActions').innerHTML = tabId && tabId !== '__new'
      ? `<button class="btn blue block" data-place="tab" ${empty ? 'disabled' : ''}>Add to ${esc(tabById(tabId)?.name)}'s tab</button>`
      : `<button class="btn green block" data-place="paynow" ${empty ? 'disabled' : ''}>Pay now</button>
         <button class="btn block" data-place="later" ${empty ? 'disabled' : ''}>Place order — pay later</button>`;
  }

  $('#menu').addEventListener('click', e => {
    const b = e.target.closest('[data-add]');
    if (!b) return;
    const id = b.dataset.add;
    ui.cart[id] = (ui.cart[id] || 0) + 1;
    renderOrderView();
  });
  $('#cartItems').addEventListener('click', e => {
    const inc = e.target.closest('[data-inc]'), dec = e.target.closest('[data-dec]');
    if (inc) ui.cart[inc.dataset.inc]++;
    if (dec) { const id = dec.dataset.dec; ui.cart[id]--; if (ui.cart[id] <= 0) delete ui.cart[id]; }
    if (inc || dec) renderOrderView();
  });
  $('#clearCart').addEventListener('click', resetCart);
  $('#cartBar').addEventListener('click', () => $('.cart').scrollIntoView({ behavior: 'smooth', block: 'start' }));
  function resetCart() {
    ui.cart = {};
    $('#customerName').value = '';
    $('#orderNote').value = '';
    $('#tabSelect').value = '';
    renderOrderView();
  }
  $('#tabSelect').addEventListener('change', async e => {
    if (e.target.value === '__new') {
      const tab = await promptNewTab($('#customerName').value.trim());
      renderTabSelect(tab ? tab.id : '');
    }
    const t = tabById($('#tabSelect').value);
    if (t && !$('#customerName').value.trim()) $('#customerName').value = t.name;
    renderCartActions();
  });
  $('#cartActions').addEventListener('click', async e => {
    const b = e.target.closest('[data-place]');
    if (!b || b.disabled) return;
    const mode = b.dataset.place;
    const lines = cartLines();
    if (!lines.length) return;
    const tabId = mode === 'tab' ? $('#tabSelect').value : null;
    const total = cartTotal();
    let payment = null;
    if (mode === 'paynow') {
      payment = await payDialog(total, 'Pay for order');
      if (!payment) return;
    }
    const today = dayKey(Date.now());
    const no = db.orders.filter(o => dayKey(o.at) === today).length + 1;
    const order = {
      id: uid(), no, at: Date.now(),
      items: lines.map(l => ({ id: l.item.id, name: l.item.name, price: l.item.price, qty: l.qty })),
      total,
      customer: $('#customerName').value.trim() || (tabId ? tabById(tabId).name : ''),
      tabId: tabId || null,
      note: $('#orderNote').value.trim(),
      made: false, given: false,
      paidAt: payment ? Date.now() : null,
      method: payment ? payment.method : null,
      cancelled: false,
    };
    db.orders.push(order);
    save('orders', order);
    resetCart();
    renderActiveCount();
    toast(`Order #${no} placed` + (tabId ? ` on ${tabById(tabId).name}'s tab` : payment ? ' — paid' : ' — not paid yet'));
  });

  /* ---------- ORDERS BOARD ---------- */
  $('#orderFilter').addEventListener('click', e => {
    const b = e.target.closest('button[data-f]');
    if (!b) return;
    ui.orderFilter = b.dataset.f;
    $$('#orderFilter button').forEach(x => x.classList.toggle('active', x === b));
    renderOrders();
  });
  $('#orderSearch').addEventListener('input', renderOrders);

  function orderCard(o, { compact = false } = {}) {
    const paid = isPaid(o);
    const tab = o.tabId ? tabById(o.tabId) : null;
    const cls = o.cancelled ? 'cancelled' : isDone(o) ? 'done' : '';
    const paidBtn = tab
      ? `<button class="status ${paid ? 'on' : 'tab'}" data-act="paid" data-id="${o.id}"><span class="ico">${paid ? '✓' : '📒'}</span>${paid ? 'Paid' : 'On tab'}</button>`
      : `<button class="status ${paid ? 'on' : 'off'}" data-act="paid" data-id="${o.id}"><span class="ico">${paid ? '✓' : '₱'}</span>${paid ? 'Paid' + (o.method ? ' · ' + esc(o.method) : '') : 'Not paid'}</button>`;
    return `
      <article class="card ${cls}">
        <div class="card-head">
          <div>
            <div class="order-no">#${o.no} ${o.customer ? `<span class="who">· ${esc(o.customer)}</span>` : ''}</div>
            <div class="muted small">${compact ? dateTime(o.at) : time(o.at)}</div>
          </div>
          <div>
            ${o.cancelled ? '<span class="badge red">Cancelled</span>' : isDone(o) ? '<span class="badge green">Completed</span>' : ''}
            ${tab ? `<span class="badge">Tab: ${esc(tab.name)}</span>` : ''}
          </div>
        </div>
        <ul class="items">${o.items.map((i, idx) => {
          const d = doneCount(o, i);
          const boxes = o.cancelled ? '' : Array.from({ length: i.qty }, (_, k) =>
            `<button class="tick ${k < d ? 'on' : ''}" data-act="tick" data-id="${o.id}" data-idx="${idx}" data-k="${k}" aria-label="${esc(i.name)} ${k + 1} ${k < d ? 'done' : 'not done'}">${k < d ? '✓' : ''}</button>`).join('');
          return `<li class="${!o.cancelled && d >= i.qty ? 'item-done' : ''}"><span class="item-name"><span class="ticks">${boxes}</span><span class="item-label">${i.qty} × ${esc(i.name)}</span></span><span>${peso(i.price * i.qty)}</span></li>`;
        }).join('')}</ul>
        ${o.note ? `<div class="note">📝 ${esc(o.note)}</div>` : ''}
        <div class="card-total"><span>Total</span><span>${peso(o.total)}</span></div>
        ${o.cancelled ? '' : `
        <div class="status-row">
          ${(() => { const p = madeProgress(o); return `<button class="status ${o.made ? 'on' : p.done ? 'part' : 'off'}" data-act="made" data-id="${o.id}"><span class="ico">${o.made ? '✓' : p.done ? p.done + '/' + p.total : '🍳'}</span>${o.made ? 'Made' : p.done ? 'Partly made' : 'Not made'}</button>`; })()}
          ${paidBtn}
          <button class="status ${o.given ? 'on' : 'off'}" data-act="given" data-id="${o.id}"><span class="ico">${o.given ? '✓' : '🤲'}</span>${o.given ? 'Given' : 'Not given'}</button>
        </div>`}
        <div class="card-foot">
          <span></span>
          ${o.cancelled
            ? `<button class="link" data-act="restore" data-id="${o.id}">Restore order</button>`
            : `<button class="link" data-act="cancel" data-id="${o.id}">Cancel order</button>`}
        </div>
      </article>`;
  }

  function renderOrders() {
    const q = $('#orderSearch').value.trim().toLowerCase();
    let list = [...db.orders].sort((a, b) => b.at - a.at);
    if (ui.orderFilter === 'active') list = list.filter(o => !o.cancelled && !isDone(o)).reverse(); // oldest first = queue
    if (ui.orderFilter === 'done') list = list.filter(o => o.cancelled || isDone(o));
    if (q) list = list.filter(o => (o.customer || '').toLowerCase().includes(q) || ('#' + o.no) === q || String(o.no) === q.replace('#', ''));
    if (ui.orderFilter !== 'active') list = list.slice(0, 200);
    $('#ordersList').innerHTML = list.length
      ? list.map(o => orderCard(o, { compact: dayKey(o.at) !== dayKey(Date.now()) })).join('')
      : `<div class="empty">${ui.orderFilter === 'active' ? 'No open orders. 🎉' : 'Nothing here yet.'}</div>`;
  }

  async function handleOrderAction(act, id, btn) {
    const o = db.orders.find(x => x.id === id);
    if (!o) return;
    if (act === 'made') {
      // the big button marks everything made (or, if all made, undoes it)
      const all = !o.made;
      o.items.forEach(it => { it.done = all ? it.qty : 0; });
      o.made = all;
    }
    if (act === 'tick') {
      const idx = +btn.dataset.idx, k = +btn.dataset.k;
      const cur = doneCount(o, o.items[idx]);
      // each box is one portion: tap an empty box = one more done, tap a ticked box = one fewer
      setItemDone(o, idx, k < cur ? cur - 1 : cur + 1);
    }
    if (act === 'given') o.given = !o.given;
    if (act === 'paid') {
      if (o.tabId) {
        ui.selectedTab = o.tabId;
        show('tabs');
        toast(`Settle this from ${tabById(o.tabId)?.name}'s tab`);
        return;
      }
      if (o.paidAt) {
        if (!(await confirmDialog(`Mark order #${o.no} as NOT paid?`, 'Mark unpaid'))) return;
        o.paidAt = null; o.method = null;
      } else {
        const p = await payDialog(o.total, `Pay for order #${o.no}`, true);
        if (!p) return;
        if (p.tabId) { o.tabId = p.tabId; if (!o.customer) o.customer = tabById(p.tabId).name; }
        else { o.paidAt = Date.now(); o.method = p.method; }
      }
    }
    if (act === 'cancel') {
      if (!(await confirmDialog(`Cancel order #${o.no}${o.customer ? ' for ' + o.customer : ''}?` + (o.tabId ? ' It will be removed from the tab.' : ''), 'Cancel order'))) return;
      o.cancelled = true;
    }
    if (act === 'restore') o.cancelled = false;
    save('orders', o);
    render();
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (b && b.closest('#ordersList, #tabDetail')) handleOrderAction(b.dataset.act, b.dataset.id, b);
  });

  /* ---------- TABS ---------- */
  $('#newTabBtn').addEventListener('click', async () => {
    const t = await promptNewTab('');
    if (t) { ui.selectedTab = t.id; renderTabs(); }
  });

  function renderTabs() {
    const tabs = db.tabs.filter(t => !t.archived)
      .map(t => ({ t, l: tabLedger(t.id) }))
      .sort((a, b) => b.l.balance - a.l.balance || a.t.name.localeCompare(b.t.name));
    $('#tabsList').innerHTML = tabs.length ? tabs.map(({ t, l }) => `
      <article class="card tab-card ${ui.selectedTab === t.id ? 'selected' : ''}" data-tab="${t.id}">
        <div class="card-head">
          <div><div class="who" style="font-size:1.1rem">${esc(t.name)}</div>
          ${t.phone ? `<div class="muted small">${esc(t.phone)}</div>` : ''}</div>
          <span class="badge ${l.balance > 0 ? 'red' : 'green'}">${l.balance > 0 ? 'Owes' : 'All settled'}</span>
        </div>
        <div class="balance ${l.balance > 0 ? 'owes' : 'clear'}">${peso(Math.max(l.balance, 0))}</div>
        ${l.balance < 0 ? `<div class="small">Credit: ${peso(-l.balance)}</div>` : ''}
        <div class="muted small">${l.orders.length} order${l.orders.length === 1 ? '' : 's'} · ${peso(l.paid)} paid so far</div>
      </article>`).join('')
      : `<div class="empty">No tabs yet. Open one for a regular customer with “+ New tab”.</div>`;
    renderTabDetail();
  }
  $('#tabsList').addEventListener('click', e => {
    const c = e.target.closest('[data-tab]');
    if (!c) return;
    ui.selectedTab = ui.selectedTab === c.dataset.tab ? null : c.dataset.tab;
    renderTabs();
    if (ui.selectedTab) $('#tabDetail').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  function renderTabDetail() {
    const t = tabById(ui.selectedTab);
    if (!t || t.archived) { $('#tabDetail').innerHTML = ''; return; }
    const l = tabLedger(t.id);
    const rows = [
      ...l.orders.map(o => ({ at: o.at, kind: 'order', o })),
      ...l.payments.map(p => ({ at: p.at, kind: 'pay', p })),
    ].sort((a, b) => b.at - a.at);
    const unpaid = l.orders.filter(o => !l.covered.has(o.id));
    $('#tabDetail').innerHTML = `
      <div class="tab-detail">
        <div class="toolbar">
          <div>
            <h2>${esc(t.name)}'s tab</h2>
            <div class="muted small">Opened ${dateTime(t.createdAt)}</div>
          </div>
          <div class="row-btns">
            <button class="btn primary" data-tabact="order">+ New order on tab</button>
            <button class="btn green" data-tabact="pay" ${l.balance <= 0 ? 'disabled' : ''}>Record payment</button>
            <button class="btn" data-tabact="edit">Edit</button>
          </div>
        </div>
        <div class="stats">
          <div class="stat"><div class="label">Balance owed</div><div class="value" style="color:${l.balance > 0 ? 'var(--red)' : 'var(--green)'}">${peso(Math.max(l.balance, 0))}</div></div>
          <div class="stat"><div class="label">Total ordered</div><div class="value">${peso(l.charged)}</div></div>
          <div class="stat"><div class="label">Total paid</div><div class="value">${peso(l.paid)}</div></div>
          <div class="stat"><div class="label">Unpaid orders</div><div class="value">${unpaid.length}</div></div>
        </div>
        <h3>History</h3>
        ${rows.length ? `<div class="table-wrap"><table class="ledger">
          <thead><tr><th>When</th><th>What</th><th>Status</th><th class="num">Amount</th></tr></thead>
          <tbody>${rows.map(r => r.kind === 'order' ? `
            <tr>
              <td>${dateTime(r.at)}</td>
              <td>Order #${r.o.no}: ${r.o.items.map(i => `${i.qty}× ${esc(i.name)}`).join(', ')}${r.o.note ? `<div class="muted small">📝 ${esc(r.o.note)}</div>` : ''}</td>
              <td>${l.covered.has(r.o.id) ? '<span class="badge green">Paid</span>' : '<span class="badge red">Unpaid</span>'}
                  ${r.o.made ? '' : '<span class="badge">Not made</span>'} ${r.o.given ? '' : '<span class="badge">Not given</span>'}</td>
              <td class="num">${peso(r.o.total)}</td>
            </tr>` : `
            <tr>
              <td>${dateTime(r.at)}</td>
              <td>💵 Payment${r.p.method ? ' · ' + esc(r.p.method) : ''} <button class="link" data-delpay="${r.p.id}">undo</button></td>
              <td></td>
              <td class="num" style="color:var(--green)">−${peso(r.p.amount)}</td>
            </tr>`).join('')}</tbody>
        </table></div>` : '<p class="muted">No orders yet.</p>'}
        ${l.balance <= 0 ? `<p><button class="link" data-tabact="archive">Close this tab</button></p>` : ''}
      </div>`;
  }

  $('#tabDetail').addEventListener('click', async e => {
    const t = tabById(ui.selectedTab);
    if (!t) return;
    const del = e.target.closest('[data-delpay]');
    if (del) {
      const p = db.tabPayments.find(x => x.id === del.dataset.delpay);
      if (p && await confirmDialog(`Undo the ${peso(p.amount)} payment?`, 'Undo payment')) {
        db.tabPayments = db.tabPayments.filter(x => x !== p);
        removeDoc('tabPayments', p.id); renderTabs();
      }
      return;
    }
    const b = e.target.closest('[data-tabact]');
    if (!b || b.disabled) return;
    const act = b.dataset.tabact;
    if (act === 'order') {
      show('order');
      renderTabSelect(t.id);
      $('#customerName').value = t.name;
      renderCartActions();
    }
    if (act === 'pay') {
      const bal = tabLedger(t.id).balance;
      const p = await payDialog(bal, `Payment from ${t.name}`, false, true);
      if (!p) return;
      const pay = { id: uid(), tabId: t.id, amount: p.amount, method: p.method, at: Date.now() };
      db.tabPayments.push(pay);
      save('tabPayments', pay); renderTabs();
      const nb = tabLedger(t.id).balance;
      toast(nb > 0 ? `Got ${peso(p.amount)} — ${t.name} still owes ${peso(nb)}` : `${t.name}'s tab is fully settled 🎉`);
    }
    if (act === 'edit') {
      const r = await formDialog(`Edit tab`, [
        { key: 'name', label: 'Name', value: t.name, required: true },
        { key: 'phone', label: 'Phone / note', value: t.phone || '' },
      ], 'Save');
      if (r) { t.name = r.name; t.phone = r.phone; save('tabs', t); renderTabs(); }
    }
    if (act === 'archive') {
      if (await confirmDialog(`Close ${t.name}'s tab? Their history stays in Sales and Orders.`, 'Close tab')) {
        t.archived = true; ui.selectedTab = null; save('tabs', t); renderTabs();
      }
    }
  });

  async function promptNewTab(defaultName) {
    const r = await formDialog('Open a new tab', [
      { key: 'name', label: 'Customer name', value: defaultName, required: true },
      { key: 'phone', label: 'Phone / note (optional)', value: '' },
    ], 'Open tab');
    if (!r) return null;
    const existing = db.tabs.find(t => !t.archived && t.name.toLowerCase() === r.name.toLowerCase());
    if (existing) { toast(`${existing.name} already has a tab`); return existing; }
    const t = { id: uid(), name: r.name, phone: r.phone, createdAt: Date.now(), archived: false };
    db.tabs.push(t);
    save('tabs', t);
    toast(`Tab opened for ${t.name}`);
    return t;
  }

  /* ---------- SALES ---------- */
  $('#salesDate').addEventListener('change', e => { ui.salesDate = e.target.value || dayKey(Date.now()); renderSales(); });
  function renderSales() {
    $('#salesDate').value = ui.salesDate;
    const day = ui.salesDate;
    const orders = db.orders.filter(o => dayKey(o.at) === day && !o.cancelled);
    const sold = orders.reduce((s, o) => s + o.total, 0);
    const direct = db.orders.filter(o => !o.cancelled && !o.tabId && o.paidAt && dayKey(o.paidAt) === day);
    const tabPays = db.tabPayments.filter(p => dayKey(p.at) === day);
    const byMethod = {};
    for (const o of direct) byMethod[o.method || 'Cash'] = (byMethod[o.method || 'Cash'] || 0) + o.total;
    for (const p of tabPays) byMethod[p.method || 'Cash'] = (byMethod[p.method || 'Cash'] || 0) + p.amount;
    const collected = Object.values(byMethod).reduce((a, b) => a + b, 0);
    const unpaidWalkIns = db.orders.filter(o => !o.cancelled && !o.tabId && !o.paidAt);
    const unpaidWalkInTotal = unpaidWalkIns.reduce((s, o) => s + o.total, 0);
    const tabOwed = db.tabs.reduce((s, t) => s + Math.max(tabLedger(t.id).balance, 0), 0);
    const items = {};
    for (const o of orders) for (const i of o.items) {
      items[i.name] = items[i.name] || { qty: 0, amt: 0 };
      items[i.name].qty += i.qty; items[i.name].amt += i.qty * i.price;
    }
    const itemRows = Object.entries(items).sort((a, b) => b[1].qty - a[1].qty);
    $('#salesBody').innerHTML = `
      <div class="stats">
        <div class="stat"><div class="label">Orders</div><div class="value">${orders.length}</div></div>
        <div class="stat"><div class="label">Sold</div><div class="value">${peso(sold)}</div></div>
        <div class="stat"><div class="label">Money collected</div><div class="value" style="color:var(--green)">${peso(collected)}</div>
          <div class="muted small">${Object.entries(byMethod).map(([m, v]) => `${esc(m)} ${peso(v)}`).join(' · ') || '—'}</div></div>
        <div class="stat"><div class="label">Owed on tabs (all)</div><div class="value" style="color:var(--red)">${peso(tabOwed)}</div></div>
        <div class="stat"><div class="label">Unpaid walk-in orders (all)</div><div class="value" style="color:var(--red)">${peso(unpaidWalkInTotal)}</div>
          <div class="muted small">${unpaidWalkIns.length} order${unpaidWalkIns.length === 1 ? '' : 's'}</div></div>
      </div>
      <h3>Items sold</h3>
      ${itemRows.length ? `<div class="table-wrap"><table class="ledger">
        <thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Amount</th></tr></thead>
        <tbody>${itemRows.map(([n, v]) => `<tr><td>${esc(n)}</td><td class="num">${v.qty}</td><td class="num">${peso(v.amt)}</td></tr>`).join('')}</tbody>
      </table></div>` : '<p class="muted">No sales on this day.</p>'}
      <p class="muted small">“Sold” counts every order placed that day. “Money collected” counts cash/GCash actually received that day, including tab payments.</p>`;
  }

  /* ---------- SETTINGS / MENU ---------- */
  function renderSettings() {
    $('#menuEditor').innerHTML = `
      <datalist id="catList">${categories().map(c => `<option value="${esc(c)}">`).join('')}</datalist>
      ${db.menu.map((m, i) => `
        <div class="menu-row" data-i="${i}">
          <input class="cat-input" list="catList" value="${esc(m.cat)}" data-k="cat" aria-label="Category" placeholder="Category">
          <input value="${esc(m.name)}" data-k="name" aria-label="Name" placeholder="Item name">
          <input type="number" inputmode="decimal" min="0" step="1" value="${m.price}" data-k="price" aria-label="Price">
          <button class="icon-btn" data-del="${i}" aria-label="Delete item">✕</button>
        </div>`).join('')}`;
  }
  $('#menuEditor').addEventListener('change', e => {
    const row = e.target.closest('.menu-row');
    if (!row) return;
    const m = db.menu[+row.dataset.i];
    const k = e.target.dataset.k;
    if (k === 'price') m.price = Math.max(0, parseFloat(e.target.value) || 0);
    else m[k] = e.target.value.trim() || m[k];
    save('menu');
    toast('Menu saved');
  });
  $('#menuEditor').addEventListener('click', async e => {
    const b = e.target.closest('[data-del]');
    if (!b) return;
    const m = db.menu[+b.dataset.del];
    if (await confirmDialog(`Remove “${m.name}” from the menu?`, 'Remove')) {
      db.menu.splice(+b.dataset.del, 1);
      delete ui.cart[m.id];
      save('menu'); renderSettings();
    }
  });
  $('#addMenuItem').addEventListener('click', () => {
    db.menu.push({ id: uid(), cat: db.menu.at(-1)?.cat || 'Food', name: 'New item', price: 0 });
    save('menu'); renderSettings();
    const inputs = $$('#menuEditor .menu-row:last-child input');
    inputs[1]?.select();
  });
  $('#exportBtn').addEventListener('click', async () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
    const filename = `mojo-dojo-backup-${dayKey(Date.now())}.json`;
    if (window.claude && window.claude.use) {
      const dl = await window.claude.use('downloads').catch(() => null);
      if (dl) {
        try { await dl.save({ filename, data: blob }); }
        catch (e) { if (e && e.code !== 'declined') toast('Could not download the backup here'); }
        return;
      }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `mojo-dojo-backup-${dayKey(Date.now())}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  $('#importFile').addEventListener('change', async e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (!Array.isArray(d.orders) || !Array.isArray(d.menu)) throw new Error('bad file');
      if (!(await confirmDialog('Replace everything on this device with this backup?', 'Restore'))) return;
      db = { ...blank(), ...d };
      await replaceAll(); toast('Backup restored'); render();
    } catch { toast('That file is not a Mojo Dojo backup'); }
  });
  $('#resetBtn').addEventListener('click', async () => {
    if (!(await confirmDialog('Erase ALL orders, tabs and payments? Download a backup first if unsure.', 'Erase everything'))) return;
    db = blank(); ui.cart = {}; ui.selectedTab = null;
    await replaceAll(); toast('All data erased'); render();
  });

  /* ---------- dialogs ---------- */
  const modal = $('#modal');
  function openModal(html, onReady) {
    return new Promise(resolve => {
      $('#modalBody').innerHTML = html;
      const done = val => { modal.close(); resolve(val); };
      modal.onclose = () => resolve(null);
      $('#modalBody').onsubmit = ev => ev.preventDefault();
      $('#mBack').onclick = () => done(null);
      onReady(done);
      modal.showModal();
    });
  }
  function confirmDialog(msg, okLabel = 'OK') {
    return openModal(`
      <h3>${esc(msg)}</h3>
      <div class="modal-actions">
        <button class="btn" type="button" id="mBack">Back</button>
        <button class="btn primary" type="button" id="mOk">${esc(okLabel)}</button>
      </div>`, done => { $('#mOk').onclick = () => done(true); });
  }
  function formDialog(title, fields, okLabel) {
    return openModal(`
      <h3>${esc(title)}</h3>
      ${fields.map(f => `<label class="field">${esc(f.label)}<input data-k="${f.key}" value="${esc(f.value)}" ${f.required ? 'required' : ''} autocomplete="off"></label>`).join('')}
      <div class="modal-actions">
        <button class="btn" type="button" id="mBack">Back</button>
        <button class="btn primary" type="submit" id="mOk">${esc(okLabel)}</button>
      </div>`, done => {
        $('#modalBody').onsubmit = ev => {
          ev.preventDefault();
          const r = {};
          $$('#modalBody input[data-k]').forEach(i => r[i.dataset.k] = i.value.trim());
          if (fields.some(f => f.required && !r[f.key])) return;
          done(r);
        };
        setTimeout(() => $('#modalBody input')?.focus(), 30);
      });
  }
  /* Payment dialog. allowTab: offer "put on a tab" instead. editableAmount: partial tab payments. */
  function payDialog(total, title, allowTab = false, editableAmount = false) {
    const openTabs = db.tabs.filter(t => !t.archived);
    return openModal(`
      <h3>${esc(title)}</h3>
      <div class="big-total">${peso(total)}</div>
      ${editableAmount ? `<label class="field">Amount they're paying<input id="mAmount" class="input" type="number" inputmode="decimal" min="0" step="any" value="${total}"></label>` : ''}
      <div class="seg" id="mMethod" style="width:100%">
        <button type="button" data-m="Cash" class="active" style="flex:1">Cash</button>
        <button type="button" data-m="GCash" style="flex:1">GCash</button>
        <button type="button" data-m="Other" style="flex:1">Other</button>
      </div>
      <div id="mCashBox">
        <label class="field">Cash received<input id="mTendered" class="input" type="number" inputmode="decimal" min="0" step="any" placeholder="${total}"></label>
        <div class="quick-cash">${[...new Set([20, 50, 100, 200, 500, 1000].filter(v => v >= total).slice(0, 3))].map(v => `<button type="button" class="btn" data-q="${v}">₱${v}</button>`).join('')}<button type="button" class="btn" data-q="exact">Exact</button></div>
        <div id="mChange" class="change"></div>
      </div>
      ${allowTab && openTabs.length ? `
        <label class="field">…or put it on a tab
          <select id="mTab" class="input"><option value="">—</option>${openTabs.map(t => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('')}</select>
        </label>` : ''}
      <div class="modal-actions">
        <button class="btn" type="button" id="mBack">Back</button>
        <button class="btn green" type="button" id="mOk">Confirm payment</button>
      </div>`, done => {
        let method = 'Cash';
        const amt = () => editableAmount ? (parseFloat($('#mAmount').value) || 0) : total;
        const upd = () => {
          const tEl = $('#mTendered');
          const ch = $('#mChange');
          if (method !== 'Cash' || !tEl.value) { ch.textContent = ''; return; }
          const diff = parseFloat(tEl.value) - amt();
          ch.textContent = diff >= 0 ? `Change: ${peso(diff)}` : `Short by ${peso(-diff)}`;
          ch.classList.toggle('short', diff < 0);
        };
        $('#mMethod').onclick = e => {
          const b = e.target.closest('[data-m]'); if (!b) return;
          method = b.dataset.m;
          $$('#mMethod button').forEach(x => x.classList.toggle('active', x === b));
          $('#mCashBox').style.display = method === 'Cash' ? '' : 'none';
        };
        $('#mTendered').oninput = upd;
        if (editableAmount) $('#mAmount').oninput = upd;
        $$('[data-q]').forEach(b => b.onclick = () => { $('#mTendered').value = b.dataset.q === 'exact' ? amt() : b.dataset.q; upd(); });
        const tabSel = $('#mTab');
        if (tabSel) tabSel.onchange = () => { $('#mOk').textContent = tabSel.value ? 'Put on tab' : 'Confirm payment'; };
        $('#mOk').onclick = () => {
          if (tabSel && tabSel.value) return done({ tabId: tabSel.value });
          const a = amt();
          if (!(a > 0)) { toast('Enter an amount'); return; }
          const tendered = parseFloat($('#mTendered').value);
          if (method === 'Cash' && tendered && tendered < a) { toast('Cash received is less than the amount'); return; }
          done({ method, amount: a });
        };
      });
  }

  /* ---------- boot ---------- */
  render();
  connect();
})();
