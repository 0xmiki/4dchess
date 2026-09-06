# Design language

4D chess opens with a choice to play. The home page places stacked play cards beside a live Easy-versus-Easy tesseract demo. Matches retain four flat boards beside the projection. Teaching lives on `/how-to-play`, separate from the returning player's path.

Values live in `src/lib/design.css`. Import this file directly from the root layout so token edits update reliably during development. Reusable controls live in `src/lib/components/`.

## Screens

- Home: two stacked play cards on the left, a learn link beneath, an optional return-to-match link, and the tesseract on the right.
- Side selection lives on home. Friend play creates an invitation directly with a stable request ID; `/friend` redirects home. Computer play starts or restores a game directly. Further computer settings remain in the new-game dialog.
- Match: turn or result above the position. Status and invitation controls occupy a separate side column, leaving the board position independent of waiting, active, and finished states. On narrow screens the information follows the board. A contextual footer holds Back to play, New game, and Options. Dropdown actions are flat rows; Escape, outside click, and arrow keys work. No global navbar.
- How to play: one piece and one target move at a time, using the real board. Show move demonstrates the task; Next lesson appears after success. A lesson selector allows jumping between pieces. Free practice permits either color with movement rules but no turns or king-safety restrictions, with a full position, undo, and reset. Add piece reveals a piece/color picker and click-to-place mode; Starting square uses the first vacant original starting square for that piece. Undo restores replaced pieces. No guest session is needed.

## Color

| Role                | Treatment                                                      |
| ------------------- | -------------------------------------------------------------- |
| Background          | Neutral charcoal and gray surfaces.                            |
| Primary play action | White fill, dark text, gray lower edge.                        |
| Secondary controls  | Raised gray, white text, visible gray lower edge.              |
| Fourth dimension    | Neutral dashed connections, labelled W.                        |
| Board               | Light and medium gray squares.                                 |
| Last move           | Contrasting gray squares.                                      |
| Selection           | Light gray square with an inset boundary.                      |
| Legal destination   | Green dot; captures have a separate marker.                    |
| Check               | Red-tinted square, supported by turn-state text.               |
| Black-piece arrows  | Muted mauve for Black pieces, with a dark outline.             |
| White-piece arrows  | Muted teal for White pieces, with the same dark outline.       |
| Pieces              | White and charcoal. Floating dark pieces have a light outline. |

Threat colors identify White and Black ownership. The outline separates arrows from both square colors; dashes distinguish defenders from attackers. Right-clicking targets accumulates annotations, recomputed when the position changes. Left-clicking the board or Clear inspection dismisses them. The attack map includes both colors and pinned pieces; it does not certify that every capture is legal. Text in the inspection summary names each relationship. [WCAG guidance on use of color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html).

Normal text targets at least 4.5:1 contrast. Core control boundaries and meaningful marks target at least 3:1. Token-pair tests cover text, pieces, and the two sides of arrow boundaries. These checks are not a complete accessibility audit. [WCAG minimum text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum).

## Type, spacing, and shape

UI text uses a sans-serif stack. Coordinates and measurements use `--font-data`. Do not rely on an operating system's `system-ui` alias for the UI font: its configuration can unexpectedly make the entire interface monospace.

Use `--space-1` through `--space-8`: 4, 8, 12, 16, 24, 32, 48, and 64 pixels. Use smaller steps within groups and larger steps between tasks. Shared controls and main page layouts use these tokens. Chess geometry and SVG coordinates are independent of this spacing scale.

Controls use `--radius-control` at 12px; play cards and panels use `--radius-panel` at 20px. Keep chess squares square. Standard controls use `--control-height` at 48px.

UI icons use `phosphor-svelte`, imported by individual icon path. Chess pieces and the tesseract mark remain their own artwork. Brand and navigation colors are neutral; colors remain only for gameplay states such as threats and legal moves.

## Press and focus states

Buttons have a three-pixel lower edge. Pressing moves the face down by the same amount and collapses the shadow; hover brightens the face. `--motion-press` controls the transition. Reduced motion removes the transition.

Pointer interaction never draws a ring around the tesseract. Keyboard focus changes its background instead. Buttons, board cells, and form fields use brightness or background changes for keyboard focus, without focus rings. Diagrams retain arrow-key rotation and Home reset. The tesseract has no visible toolbar or reset button. Home also hides axis annotations and the W caption; its layout centers the controls and projection in the available viewport.

## Geometry and teaching

Use actual game coordinates. The nested cubes represent equally sized W layers; projection makes one appear smaller. The camera uses a fixed enlarged projection scale. Do not refit or normalize its bounds during rotation: this introduces a visible zoom as corners change position.

The lesson board and tesseract show the same move together. Learners can compare directly rather than remember a previous screen. [Recognition and recall guidance](https://www.nngroup.com/articles/recognition-and-recall/).

Learners make moves themselves or play the example. Invalid destinations cannot be played. Rotation changes presentation only. The home demo uses the Easy search worker for both sides, animates moves and camera turns, then restarts after an actual result. It pauses offscreen, when the tab is hidden, or on manual orbit; a pause/play control is available. Reduced motion skips travel and orbit. Search workers and timers are cleaned up on navigation. Special rules remain expandable. [Progressive disclosure guidance](https://www.nngroup.com/articles/progressive-disclosure/).

## Results and loading

Wins, losses, and draws have an explicit result card. Fresh wins briefly show confetti unless reduced motion is requested. Fresh checkmates play a short synthesized cue after the browser has received a user gesture; restored results do not replay effects. No external audio asset is loaded.

Friend creation replaces the play-card arrow with a spinner while keeping the card size unchanged. Back links share a chevron component.

## References and review

The user's references are [Chess.com's play flow](https://www.chess.com/play) and [Duolingo's design work](https://blog.duolingo.com/hub/design/). This implementation uses raised button faces and separates playing from learning without copying their artwork.

Review home, setup, an active match, an ending, and the guide at desktop and mobile sizes. Validate changes locally before any deployment.
