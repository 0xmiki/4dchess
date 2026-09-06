# Design language

4D chess opens with a choice to play. The home page places stacked play cards beside a live Easy-versus-Easy tesseract demo. Matches retain four flat boards beside the projection. Teaching lives on `/how-to-play`, separate from the returning player's path.

Values live in `src/lib/design.css`. Import this file directly from the root layout so token edits update reliably during development. Reusable controls live in `src/lib/components/`.

## Screens

- Home: two stacked play cards on the left, a learn link beneath, and the tesseract on the right.
- Side selection lives on home. Friend play creates an invitation directly with a stable request ID; `/friend` redirects home. Computer play starts or restores a game directly. Computer side and difficulty settings sit above New game in the sidebar. During a game, Resign replaces New game. Resignation is confirmed, persisted, and stops computer search; new-game settings appear after the result.
- Match: a small turn indicator beside the moves and a result card when the game ends. Invitation controls and a compact turn indicator occupy a separate side column, leaving the board position independent of waiting, active, and finished states. On narrow screens the information follows the board. The sidebar holds Resign above a compact two-column score sheet; New game appears only after the game ends. Computer settings are inline for the next game. There are no back, options, or rules controls. Export dismisses on an outside click or Escape.
- How to play: one piece and one target move at a time, using the real board. Controls and explanations occupy a sidebar, following the same board-first layout as matches. Show move demonstrates the task; Next lesson appears after success. A lesson selector allows jumping between pieces. Free practice permits either color with movement rules but no turns or king-safety restrictions, with a full position, undo, and reset. Free practice switches between Move pieces and Place pieces. Placement shows a compact six-piece palette and color toggle; Starting square uses the first vacant original starting square for that piece. Undo restores replaced pieces. No guest session is needed.

## Color

The app chrome remains neutral, while primary play actions use the game’s muted green. The game palette has three roles: muted green (`--game-primary`) for board identity and legal movement, aged brass (`--game-secondary`) for selection and move emphasis, and an oxblood tint (`--game-tertiary`) for opposing pressure. Light squares and White pieces use warm parchment and ivory.

| Role                | Treatment                                                      |
| ------------------- | -------------------------------------------------------------- |
| Background          | Neutral charcoal and gray surfaces.                            |
| Primary play action | Muted green fill, light text, darker green lower edge.         |
| Secondary controls  | Raised gray, white text, visible gray lower edge.              |
| Fourth dimension    | Neutral dashed connections, labelled W.                        |
| Board               | Parchment and muted green squares.                             |
| Last move           | Aged-brass square highlights.                                  |
| Selection           | A muted brass square, without a border ring.                   |
| Legal destination   | Muted green dot; captures have a separate marker.              |
| Check               | Red-tinted square, supported by turn-state text.               |
| Black-piece arrows  | Oxblood-tinted arrows for Black pieces.                        |
| White-piece arrows  | Aged-brass arrows for White pieces.                            |
| Pieces              | White and charcoal. Floating dark pieces have a light outline. |

Threat colors identify White and Black ownership. Flat-board arrows are broad and translucent; tesseract arrows are thin so they do not obscure pieces. Both use filled heads without edge outlines. Inspection details remain available to screen readers. Right-clicking targets accumulates annotations, recomputed when the position changes. Left-clicking the board dismisses them. A compact hint explains right-click inspection on desktop and long-press inspection on touch. There is no inspection panel or inspection button. The attack map includes both colors and pinned pieces; it does not certify that every capture is legal. [WCAG guidance on use of color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html).

Normal text targets at least 4.5:1 contrast. Core control boundaries and meaningful marks target at least 3:1. Token-pair tests cover text, pieces, and base palette contrasts; translucent annotation rendering is reviewed visually. These checks are not a complete accessibility audit. [WCAG minimum text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum).

## Type, spacing, and shape

UI text uses a sans-serif stack. Coordinates and measurements use `--font-data`. Do not rely on an operating system's `system-ui` alias for the UI font: its configuration can unexpectedly make the entire interface monospace.

Use `--space-1` through `--space-8`: 4, 8, 12, 16, 24, 32, 48, and 64 pixels. Use smaller steps within groups and larger steps between tasks. Shared controls and main page layouts use these tokens. Chess geometry and SVG coordinates are independent of this spacing scale.

Controls use `--radius-control` at 12px; play cards and panels use `--radius-panel` at 20px. Keep chess squares square. Standard controls use `--control-height` at 48px.

UI icons use `phosphor-svelte`, imported by individual icon path. Chess pieces and the tesseract mark remain their own artwork. Brand and navigation colors are neutral; colors remain only for gameplay states such as threats and legal moves.

Select fields use styled popover listboxes with arrow-key navigation, Home/End, type-ahead, Escape, and outside dismissal. Their options do not depend on the browser’s native select-menu styling.

## Press and focus states

Buttons have a three-pixel lower edge. Pressing moves the face down by the same amount and collapses the shadow; hover brightens the face. `--motion-press` controls the transition. Reduced motion removes the transition.

Pointer interaction never draws a ring around the tesseract. Keyboard focus changes its background instead. Buttons, board cells, and form fields use brightness or background changes for keyboard focus, without focus rings. Diagrams retain arrow-key rotation and Home reset. The tesseract has no visible toolbar or reset button. Home also hides axis annotations and the W caption. Shared board-column, sidebar, and gap tokens give its tesseract the exact canvas size used by a game at the same viewport width. Regression checks compare both views at four viewport sizes.

## Rooms

A friend room keeps its URL, invitation, and seats across rounds. New game is available after a finished round. Starting it creates a fresh game record; previous results and move history remain stored. Simultaneous starts compare the expected finished game ID and resolve to one current game. Stale move commands still target their original game and cannot spill into a new round.

## Geometry and teaching

Use actual game coordinates. The nested cubes represent equally sized W layers; projection makes one appear smaller. The camera uses the original HTML projection scale of 86 on both screen axes, centered at 220,220 in its square viewBox. Do not refit or normalize its bounds during rotation: this introduces a visible zoom as corners change position.

The lesson board and tesseract show the same move together. Learners can compare directly rather than remember a previous screen. [Recognition and recall guidance](https://www.nngroup.com/articles/recognition-and-recall/).

Learners make moves themselves or play the example. Invalid destinations cannot be played. Rotation changes presentation only. Tesseract geometry, pieces, and annotations use neutral local tokens, with low-opacity surfaces. Board colors remain confined to the flat boards.

The home demo uses the Easy search worker for both sides, chooses a camera angle near the normal game view, penalizing overlaps between inner pieces. It orbits first, holds selection for 1.1 seconds, previews the destination, moves the piece, and settles before committing the position. Pausing freezes the current phase and resumes without skipping the move, then restarts after an actual result. It pauses offscreen, when the tab is hidden, or on manual orbit; a pause/play control is available. Reduced motion skips travel and orbit. The piece remains in the static board until its actual travel phase, preventing the early overlay swap. The move’s board state is committed only after travel and settling. In actual games, ordinary moves take 650ms, knights 850ms, and cross-board moves 1100ms. Cross-board travel bows toward a gutter in the flat view and takes a subtle curved path in the tesseract. Knights retain their lift; same-board ordinary moves remain straight. Reduced motion skips travel. Search workers and timers are cleaned up on navigation. Special rules remain expandable. [Progressive disclosure guidance](https://www.nngroup.com/articles/progressive-disclosure/).

Container scrollbars use a thin thumb on a transparent track, without arrow buttons or a track background.

## History and resume

The score sheet uses chess-style piece letters, captures, promotion and check suffixes, with destination board coordinates for 4D disambiguation. Selecting a move reconstructs that position without modifying the live game. The selected ply is highlighted, and Previous/Next/Live controls navigate the loaded history. Older online pages load on demand.

Home automatically restores the remembered room using the existing identity. It does not create a guest just to check a save. Finishing a game clears auto-resume while preserving its history. Home also checks for terminal results before following stale resume pointers. Leave room is only available before a game starts or after it ends. During an active game, players resign first. Closing an unjoined room returns to home. Explicit leave markers prevent old saves from silently opting back into resume.

Online moves are simulated immediately against the current revision. The provisional board remains read-only until confirmation. Typed server rejections roll back to the authoritative state. Transport uncertainty keeps the idempotent request for retry; revision advancement reconciles the provisional board without a second animation. Historical review remains separate from both states.

## Results and loading

Wins, losses, and draws have an explicit result card. Fresh wins briefly show confetti unless reduced motion is requested. Fresh checkmates play a short synthesized cue after the browser has received a user gesture; restored results do not replay effects. No external audio asset is loaded.

Friend creation replaces the play-card arrow with a spinner while keeping the card size unchanged. Route loading uses a full-viewport centered loading screen. Play and learning layouts share `--play-space` for balanced top and bottom gutters. The side toggle uses `--motion-selection` and `--ease-selection` for its sliding selection pill, with reduced-motion support.

## References and review

The user's references are [Chess.com's play flow](https://www.chess.com/play) and [Duolingo's design work](https://blog.duolingo.com/hub/design/). This implementation uses raised button faces and separates playing from learning without copying their artwork.

Review home, setup, an active match, an ending, and the guide at desktop and mobile sizes. Validate changes locally before any deployment.
