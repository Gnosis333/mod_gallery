# pachinko

A tall plinko/pachinko pane that Claude's work feeds. Every turn start and tool call drops a ball through a randomly laid-out pin board (strong bounces, bumpers, gold pins, gaps) into one of 13 slots that pay coins. The center slot spins three reels; matching digits give bonus balls, 7-7-7 starts chance time. Commits, passing tests and a failed-then-fixed test drop special balls, errors drop a dud, and a rare gold ball is a jackpot. A fixed 10,000-coin goal plays a confetti celebration each time you reach it. Balls move like falling things (they slow over the top of a hop and speed up coming down), each pin answers with a ring when struck and has its own spring, and a quiet grey ball drops by itself while nothing is happening, so there is always something to watch. Spins show omens (plain to gold) and wait as colored hold lamps, and twelve misses in a row guarantee a 7-7-7. The 📖 button (or `/pachinko balls`) explains every ball.

**Labels are Korean only for now** (no `language` option yet).

## Install

```bash
claude plugin marketplace add Gnosis333/mod_gallery
claude plugin install pachinko@mod-gallery --scope user
```

Then run `/reload-plugins` or start a new session. The panel opens with `/pachinko`. `/pachinko drop [n]` drops free balls without spending tokens, `/pachinko balls` lists the balls, `/pachinko goal` fills the coins to just short of the goal to try the celebration, and `/pachinko reset` starts the score over.

## What it does and does not do

It draws an animated SVG pane and one slash command. Coins and goal progress are kept with the plugin's own store (shared across sessions). It makes no network requests, reads or writes no files, runs no processes, and sends no data anywhere.

Part of [mod_gallery](https://github.com/Gnosis333/mod_gallery). MIT licensed.
