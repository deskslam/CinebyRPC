# Setup

You need two things running: this project's **helper** and its **browser
extension**. And your **Discord desktop app** has to be open — the phone app and
the website don't have the connection this uses.

New here and wondering what any of this actually is? Read
[PLAIN-ENGLISH.md](../readme.md) first.

Everything below is Windows + a Chrome-family browser (Chrome, Brave, Edge).

---

## Step 1 — build the helper

You only do this once. You need [Node.js](https://nodejs.org) installed (any
recent version).

Open PowerShell in the project folder and run:

```powershell
cd packaging
npm install
node build.mjs
```

That spits out `packaging\dist\cinebyRPC-helper.exe`. It's about 55 MB because it
carries its own copy of Node inside it — that's why you don't have to install
anything else to *run* it.

If someone already handed you a `cinebyRPC-helper.exe`, just drop it in
`packaging\dist\` and skip this step.

## Step 2 — install the helper

```powershell
powershell -ExecutionPolicy Bypass -File packaging\install.ps1
```

No admin password needed. This copies the exe somewhere permanent
(`%LOCALAPPDATA%\cinebyRPC`) and tells your browsers "if the Cineby extension
asks for me, here I am."

There's **no background app that's always running** and nothing added to your
startup. The browser starts the helper the moment you open a cineby.rocks tab,
and kills it when you close the last one.

## Step 3 — load the extension

1. Go to `chrome://extensions` (or `brave://extensions`, `edge://extensions`).
2. Flip on **Developer mode** (top-right).
3. Click **Load unpacked** and pick the `extension` folder.

The extension should show the ID `mdgoeaelfcglnapppbljjbfgmnfbmlgd`. If it shows
something else, you loaded a moved or renamed copy of the folder — either load it
from where it originally was, or re-run the installer as
`packaging\install.ps1 -ExtensionId <the-id-it-shows>`.

## Step 4 — try it

Open Discord (desktop), then play a movie or episode on cineby.rocks. Give it a
few seconds. Your Discord profile should show the poster, the title, and a
countdown.

Click the extension's icon any time to check what it thinks is going on.

---

## Settings (all optional)

The helper works fine with zero configuration. If you want to change something,
make a file at `%LOCALAPPDATA%\cinebyRPC\config.json`:

```json
{
  "tmdbApiKey": "paste-a-key-here",
  "activityType": "watching",
  "showButtons": true
}
```

| Setting | What it does |
| --- | --- |
| `tmdbApiKey` | A free key from [themoviedb.org](https://www.themoviedb.org/settings/api). Adds real episode names ("Lord Snow" instead of just "S1 · E3") and release years. |
| `discordClientId` | Which Discord application the status appears under. There's one baked in already; override it only if you made your own and want your own name/art. |
| `activityType` | `"watching"` shows *Watching …*, `"playing"` shows *Playing …*. |
| `showButtons` | The "Watch on Cineby" / "View on TMDB" buttons other people see on your profile. |
| `idleTimeoutSec` | How long with no updates before the presence clears. Default 90. |

Changes take effect next time the helper starts — close every cineby.rocks tab
and open one again.

---

## Removing it

```powershell
powershell -ExecutionPolicy Bypass -File packaging\uninstall.ps1
```

Add `-Purge` to also wipe the config and log files. Then remove the extension
from your browser's extensions page.

---

## When something's not working

**The extension popup says "Helper not responding."**
Run `install.ps1` again. Check that the extension's ID matches (Step 3). Look at
`%LOCALAPPDATA%\cinebyRPC\alora.log` for the actual error.

**The popup says "Helper up, waiting for Discord."**
Open the Discord desktop app. It'll connect on its own within ~10 seconds.

**Everything looks connected but nothing shows in Discord.**
In Discord: Settings → Activity Privacy → **Share your activity** must be on. And
make sure you actually pressed play, not just opened the page.

**Episode names and years are missing.**
Add a `tmdbApiKey` (see Settings above).

**Windows SmartScreen warns about the .exe.**
Homemade .exe files trip this. Click "More info" → "Run anyway", or build it
yourself in Step 1 so it's from your own machine.

**The presence is stuck after you stopped watching.**
It clears when you close the tab. Otherwise it times out on its own after ~90
seconds.

### Poking at it directly

- Helper log: `%LOCALAPPDATA%\cinebyRPC\alora.log`
- Run the helper with a visible window: `cd app` then `npm start`
- Extension's background logs: `chrome://extensions` → the extension → "service worker"
- Fake some playback without a browser: `node tools/test-native.mjs`
