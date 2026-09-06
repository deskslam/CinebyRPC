# What is this?

You know how Discord can show "Playing Minecraft" or "Listening to Spotify"
under your name? This makes it show **what you're watching on cineby.rocks** —
the movie or show, which episode, a little poster, and how much time is left.

That's it. It's a cosmetic thing for your Discord profile.

---

## Why is it more than one piece?

Fair question. It'd be nice if it were just a browser add-on. It can't be.

Discord only lets a program talk to it if that program is **actually installed on
your computer**. A browser extension isn't — it lives inside the browser's
sandbox and isn't allowed to reach out to other apps like Discord. Discord did
this on purpose, so random websites can't mess with your Discord.

So there are two parts that split the job:

### 1. The browser extension

This is the part that watches cineby.rocks. When you're on a page playing
something, it figures out:

- what the movie/show is (from the web address and a bit of info the site
  already saved in your browser)
- whether it's playing or paused, and how far in you are (the video player
  announces this and the extension listens)

Then it hands that info off to part 2. The extension **cannot** talk to Discord
itself.

### 2. The helper

This is a small program (`cinebyRPC-helper.exe`) that sits between the extension
and Discord. It takes the "now watching X" info from the extension and tells
Discord to put it on your profile.

**You don't run it or see it.** Your browser starts it automatically when you
open a cineby.rocks tab, and shuts it down when you close that tab. No window, no
icon in your taskbar, nothing in your startup programs. When you're not on
cineby.rocks, it isn't running at all.

### The picture

```
  cineby.rocks tab                    the helper                  Discord app
 ┌────────────────┐    "now watching   ┌──────────┐   "set their   ┌─────────┐
 │  extension     │ ─── Game of ─────▶ │  .exe    │ ── status to ▶ │         │
 │  (watches the  │     Thrones S1E3"  │          │    that"       │         │
 │   page)        │                    └──────────┘                └─────────┘
 └────────────────┘
```

---

## Why is the process called "alora"?

When the helper runs, it names itself **`alora`** in the process list (Task
Manager, `ps`, etc.) instead of something like `node` or `cinebyRPC-helper`.

There's no technical reason for this. It's not a setting, it doesn't change what
the program does, and nothing depends on the name. It's named `alora` for a
friend — purely and only for a friend that I love. That's the whole reason it's there.

The name shows up in a few places, all of them just the same tribute:

| Where | What it looks like |
| --- | --- |
| The running process | shows as `alora` in Task Manager / `ps` |
| The log file | `%LOCALAPPDATA%\cinebyRPC\alora.log` |
| The startup banner | `Cineby Discord RPC  ·  alora  ·  …` |
| Each presence update in the log | `[alora #7] Game of Thrones · S1 · E3` |
| Shutdown line | `alora pushed 7 update(s) this run` |

That last one is a small counter: every time the helper tells Discord what
you're watching, it ticks up by one, and the total is written out when the
helper stops. It does nothing except count. It's there for a friend too.

---

## Is it safe? What does it send anywhere?

- **Nothing leaves your computer.** The extension talks to the helper through a
  private channel the browser sets up between them. Not the internet.
- The helper talks to Discord the same way every "Rich Presence" program does
  (games, Spotify, VS Code). It does **not** log into your Discord account, ask
  for your password, or use any secret token. It just says "show this text and
  this picture."
- The **poster image** is loaded by Discord directly from
  [themoviedb.org](https://www.themoviedb.org) (a public movie database). Your
  computer doesn't upload anything.
- If you add a "TMDB key" to get episode names, the helper looks those up from
  that same public database. That's the only time it touches the internet.
- The code is all here in this repo. It's small. You (or someone you trust) can
  read it.

The one thing to know: the helper is a `.exe` you either build yourself or get
from someone. Windows might warn you about it the first time because it's not
from a big company. If you built it yourself (see SETUP.md), that warning is just
Windows being cautious about unknown files.

---

## What are all these folders?

| Folder | What's in it |
| --- | --- |
| `extension/` | The browser add-on. This is what you load into Chrome/Brave/Edge. |
| `app/` | The source code for the helper. Not used directly — it gets bundled into the .exe. |
| `packaging/` | The scripts that turn `app/` into `cinebyRPC-helper.exe` and install it. |
| `tools/` | Little test scripts for whoever's working on this. You can ignore them. |
| `docs/` | Setup instructions. |

---

## How do I actually set it up?

See **[docs/SETUP.md](docs/SETUP.md)**. Short version: build the .exe once, run
the installer once, load the extension, done.

## How do I get rid of it?

Run `packaging\uninstall.ps1` and remove the extension from your browser. It
doesn't leave anything else behind.
