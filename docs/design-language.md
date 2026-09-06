# Design language

4D chess opens with a choice to play. The home page places stacked play cards beside the tesseract. Matches retain four flat boards beside the projection. Teaching lives on `/how-to-play`, separate from the returning player's path.

Values live in `src/lib/design.css`. Import this file directly from the root layout so token edits update reliably during development. Reusable controls live in `src/lib/components/`.

## Screens

- Home: two stacked play cards on the left, a learn link beneath, an optional return-to-match link, and the tesseract on the right.
- Friend and computer setup: one column of choices ending in one primary action.
- Match: turn or result above the position. History, rules, and export stay in the options menu. New game appears after a computer game ends.
- How to play: coordinate explanation, six selectable pieces, paired 3D/4D diagrams, playback, and mistakes. No guest session is needed.

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
| Enemy threat        | Solid orange arrow with a dark outline.                        |
| Friendly defender   | Dashed cyan arrow with the same dark outline.                  |
| Pieces              | White and charcoal. Floating dark pieces have a light outline. |

Threat colors describe the relationship to the inspected piece, not White or Black ownership. The outline separates arrows from both square colors; dashes also distinguish defenders from attackers. Text in the inspection summary names each relationship. [WCAG guidance on use of color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html).

Normal text targets at least 4.5:1 contrast. Core control boundaries and meaningful marks target at least 3:1. Token-pair tests cover text, pieces, and the two sides of arrow boundaries. These checks are not a complete accessibility audit. [WCAG minimum text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum).

## Type, spacing, and shape

UI text uses a sans-serif stack. Coordinates and measurements use `--font-data`. Do not rely on an operating system's `system-ui` alias for the UI font: its configuration can unexpectedly make the entire interface monospace.

Use `--space-1` through `--space-8`: 4, 8, 12, 16, 24, 32, 48, and 64 pixels. Use smaller steps within groups and larger steps between tasks. Shared controls and main page layouts use these tokens. Chess geometry and SVG coordinates are independent of this spacing scale.

Controls use `--radius-control` at 12px; play cards and panels use `--radius-panel` at 20px. Keep chess squares square. Standard controls use `--control-height` at 48px.

UI icons use `phosphor-svelte`, imported by individual icon path. Chess pieces and the tesseract mark remain their own artwork. Brand and navigation colors are neutral; colors remain only for gameplay states such as threats and legal moves.

## Press and focus states

Buttons have a three-pixel lower edge. Pressing moves the face down by the same amount and collapses the shadow; hover brightens the face. `--motion-press` controls the transition. Reduced motion removes the transition.

Pointer interaction never draws a ring around the tesseract. Keyboard focus changes its background instead. Native buttons and board cells retain keyboard focus indicators, and diagrams retain arrow-key rotation and Home reset. The tesseract has no visible toolbar or reset button.

## Geometry and teaching

Use actual game coordinates. The nested cubes represent equally sized W layers; projection makes one appear smaller. The camera fits the enlarged projection within its available viewport at every rotation.

The guide pairs 3D and 4D examples with flat boards and labelled coordinate changes. Learners can compare directly rather than remember a previous screen. [Recognition and recall guidance](https://www.nngroup.com/articles/recognition-and-recall/).

Moves can be played, paused, or scrubbed. Mistakes have an explicit illegal-state label. Rotation changes presentation only. Avoid perpetual rotation and decorative data. Special rules remain expandable. [Progressive disclosure guidance](https://www.nngroup.com/articles/progressive-disclosure/).

## References and review

The user's references are [Chess.com's play flow](https://www.chess.com/play) and [Duolingo's design work](https://blog.duolingo.com/hub/design/). This implementation uses raised button faces and separates playing from learning without copying their artwork.

Review home, setup, an active match, an ending, and the guide at desktop and mobile sizes. Validate changes locally before any deployment.
