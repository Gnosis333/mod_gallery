# campfire

![campfire](https://raw.githubusercontent.com/Gnosis333/mod_gallery/main/images/campfire.gif)

A tall campfire pane in a deep forest under the stars. Flames lick upward and sparks crackle off the logs, flowers ring the clearing, forested ridges rise behind, and now and then a fox trots by or an owl perches and swivels its head. While Claude works the fire roars up; when the turn ends it settles back down.

This is a mod for Claude Code: a decorative panel drawn as a hand-written SVG animation. It changes between an idle look and a working look so you have something calm to watch while Claude runs a long task.

## Install

```bash
claude plugin marketplace add Gnosis333/mod_gallery
claude plugin install campfire@mod-gallery --scope user
```

Then run `/reload-plugins` or start a new session. The panel opens only when you run `/fire`, so it costs nothing until you ask for it.

## Language

Labels are English by default. For Korean, run `echo '{"language":"ko"}' | claude plugin configure campfire@mod-gallery --values-stdin` and restart. Use `en` to switch back.

## What it does and does not do

It only draws an animated SVG pane and one slash command (`/fire`), and it reads Claude's idle or working state to switch the scene. It makes no network requests, reads or writes no files, runs no processes, and sends no data anywhere.

Part of [mod_gallery](https://github.com/Gnosis333/mod_gallery). MIT licensed.
