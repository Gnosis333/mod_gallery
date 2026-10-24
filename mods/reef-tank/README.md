# reef-tank

![reef-tank](reef-tank.gif)

A tall aquarium pane with tropical fish, a seahorse and jellyfish above a coral floor. While Claude works the pump runs, the lights come up and a small yellow submarine goes down through the water; when the turn ends the tank goes calm again.

This is a mod for Claude Code: a decorative panel drawn as a hand-written SVG animation. It changes between an idle look and a working look so you have something calm to watch while Claude runs a long task.

## Install

```bash
claude plugin marketplace add Gnosis333/mod_gallery
claude plugin install reef-tank@mod-gallery --scope user
```

Then run `/reload-plugins` or start a new session. The panel opens only when you run `/reef`, so it costs nothing until you ask for it.

## Language

Labels are English by default. For Korean, run `echo '{"language":"ko"}' | claude plugin configure reef-tank@mod-gallery --values-stdin` and restart. Use `en` to switch back.

## What it does and does not do

It only draws an animated SVG pane and one slash command (`/reef`), and it reads Claude's idle or working state to switch the scene. It makes no network requests, reads or writes no files, runs no processes, and sends no data anywhere.

Part of [mod_gallery](https://github.com/Gnosis333/mod_gallery). MIT licensed.
