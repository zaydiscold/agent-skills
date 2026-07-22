---
name: screenie
description: Use when Zayd refers to a screenshot he just took without giving a path — triggers include "screenie", "sc", "screenshot" (in the sense of *look at* one, e.g. "sc the button is broken", "check my last screenshot", "look at the screenshot", "see my screen grab"). VIEW the most recent screenshot from the macOS screenshot folder (~/Pictures/Screenshots), converting HEIC to PNG so it can be read. (This is the *view an existing* shot skill — the separate "screenshot" skill is for *capturing* a new one.)
---

# screenie — view the latest screenshot Zayd took

When Zayd says **"screenie"**, **"sc"**, or **"screenshot"** while pointing you at a grab he just took ("sc, this looks off", "look at my last screenshot", "check the screenshot") — he means **go find the most recent screenshot and look at it.** Don't ask for the path. Find it yourself.

(If he instead asks you to *take/capture* a screenshot of the screen, that's the separate `screenshot` capture skill — not this one.)

## where they live

macOS saves screenshots to **`~/Pictures/Screenshots`** on frostbyte. Confirm with:
```bash
defaults read com.apple.screencapture location
```
Files are named like `Screenshot YYYY-MM-DD at H.MM.SS AM.png` — but on this Mac they are frequently **`.heic`**, which the Read tool can't open directly.

## how to view the latest one

1. Find the newest image, any type:
   ```bash
   ls -t ~/Pictures/Screenshots/*.png ~/Pictures/Screenshots/*.heic ~/Pictures/Screenshots/*.jpg 2>/dev/null | head -1
   ```
2. If it's already `.png`/`.jpg`, **Read** it directly.
3. If it's **`.heic`**, convert to PNG first, then Read the PNG:
   ```bash
   sips -s format png "<path>" --out /tmp/latest-screenshot.png
   ```
   then Read `/tmp/latest-screenshot.png`.

## the iCloud gotcha (important)

If `sips` produces a missing / 0-byte file, the screenshot is an **iCloud "Optimize Mac Storage" placeholder** that hasn't downloaded to disk. Force it down, then retry:
```bash
brctl download "<path>" && sleep 2 && sips -s format png "<path>" --out /tmp/latest-screenshot.png
```
If it still fails, ask Zayd to open the shot once in Finder/Preview (or AirDrop/save it locally) to materialize it.

## then

Read the image, describe what's relevant, and act on whatever he asked. If "sc"/"screenie" came with a request ("sc the tap target is bad"), view the shot **and** address the request in the same turn.
