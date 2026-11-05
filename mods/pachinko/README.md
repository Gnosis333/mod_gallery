# pachinko

A tall plinko/pachinko pane that Claude's work feeds. Every turn start and tool call drops a ball through a randomly laid-out pin board (strong bounces, bumpers, gold pins, gaps) into one of 13 slots that pay coins. The center slot spins three reels; matching digits give bonus balls, 7-7-7 starts chance time. Commits, passing tests and a failed-then-fixed test drop special balls, errors drop a dud, and a rare gold ball is a jackpot. A coin goal grows each level and a confetti celebration plays when you reach it. The 📖 button (or `/pachinko balls`) explains every ball.

**Labels are Korean only for now** (no `language` option yet).

## Install

```bash
claude plugin marketplace add Gnosis333/mod_gallery
claude plugin install pachinko@mod-gallery --scope user
```

Then run `/reload-plugins` or start a new session. The panel opens with `/pachinko`. `/pachinko drop [n]` drops free balls without spending tokens, `/pachinko balls` lists the balls and `/pachinko reset` starts the score over.

## What it does and does not do

It draws an animated SVG pane and one slash command. Coins and goal progress are kept with the plugin's own store (shared across sessions). It makes no network requests, reads or writes no files, runs no processes, and sends no data anywhere.

Part of [mod_gallery](https://github.com/Gnosis333/mod_gallery). MIT licensed.
