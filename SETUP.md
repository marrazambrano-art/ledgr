# Putting Mojo Dojo POS online

About 15 minutes, all free. You need a Google account and this GitHub account.
When you're done, anyone can open the website, but only people with the PIN can see or change orders.

## 1. Turn on the website (GitHub Pages)

1. On GitHub, open this repository → **Settings** → **Pages** (left menu).
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
3. Pick branch **`claude/dazzling-gates-ezwvmv`**, folder **`/ (root)`**, and click **Save**.
4. After a minute or two the site is live at **https://marrazambrano-art.github.io/ledgr/**

Until steps 2–6 are done, the site works in "this device only" mode and asks you to create a PIN on each device.

## 2. Create a Firebase project

1. Go to **https://console.firebase.google.com** and sign in with Google.
2. Click **Create a project**, name it `mojo-dojo`, and continue. You can turn Google Analytics **off**.

## 3. Turn on PIN sign-in

1. In the left menu: **Build → Authentication → Get started**.
2. **Sign-in method** tab → **Email/Password** → switch **Enable** on → **Save**.
3. **Settings** tab → **User actions** → untick **Enable create (sign-up)** → **Save**. Strangers then can't make their own accounts.
4. **Settings** tab → **Authorized domains** → **Add domain** → `marrazambrano-art.github.io`.

## 4. Create the register account (this sets your PIN)

1. **Users** tab → **Add user**.
2. Email: `register@mojodojo.app` (it doesn't need to be a real inbox).
3. Password: **the 6-digit PIN** you want staff to type, e.g. `482913`. Avoid `123456` or a birthday.

## 5. Create the database

1. Left menu: **Build → Firestore Database → Create database**.
2. Location: **asia-southeast1 (Singapore)**, the closest to the Philippines.
3. Choose **Start in production mode** → **Create**.
4. Open the **Rules** tab, delete what's there, paste the contents of [`firestore.rules`](firestore.rules), and click **Publish**.

## 6. Connect the website to Firebase

1. Click the gear ⚙ next to **Project Overview** → **Project settings**.
2. Under **Your apps**, click the web icon **`</>`**, name it `Mojo Dojo POS`, and click **Register app** (no hosting needed).
3. Copy the `firebaseConfig = { ... }` block it shows.
4. Paste it into `config.js` in this repo, replacing `null`:

```js
window.MOJO_FIREBASE = {
  apiKey: "…",
  authDomain: "mojo-dojo-xxxx.firebaseapp.com",
  projectId: "mojo-dojo-xxxx",
  storageBucket: "…",
  messagingSenderId: "…",
  appId: "…"
};
```

These values are not secret. They only say which project to talk to. The PIN and the rules from step 5 are what protect your data.
(Or send the block to Claude and it will update `config.js` for you.)

## Using it

- Open the site, tap the logo, and enter the PIN. Each device stays signed in.
- The register locks after 2 idle minutes and shows the logo. Change the time in **Settings → Lock & PIN**.
- **Change the PIN** in Settings. It changes on every device.
- Add it to the home screen: iPhone Safari → Share → *Add to Home Screen*; Android Chrome → ⋮ → *Add to Home screen*.
- **Moving data from the old claude.ai link:** open the old link → Settings → *Download backup*, then on the new site → Settings → *Restore backup*.

## Free-plan limits

Firebase's free plan allows 50,000 reads and 20,000 writes a day, far more than a snack stand needs.
If you ever see "Could not save", check the usage page in the Firebase console.
