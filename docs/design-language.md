# Interface conventions

The app uses a charcoal background with restrained green primary actions. The flat boards use warm light squares and muted green dark squares. Selection, legal destinations, and threat arrows have distinct roles; tesseract overlays remain thin and translucent so pieces behind them stay visible.

Shared tokens live in `src/lib/design.css`. Pill controls use one sliding highlight with the shared motion duration and easing. Respect reduced-motion preferences. Controls use background and brightness changes for focus, with accessible labels and keyboard operation.

Friend games place the opponent above the two board views and the local player below. Controls and move history occupy a separate sidebar. The inspection hint follows the lower player row. On narrow screens the views and sidebar stack without changing their game state.

The same square selection and move progress drive both the flat boards and tesseract. Rotating the tesseract changes only the camera. Home uses a local self-play demo; it never creates a multiplayer game.

Keep the board position stable when a challenge is waiting, a move is pending, or a game ends. Put lifecycle controls in the sidebar. Rematches require acceptance, colors swap, and scores stay attached to players.

Use the shared controls in `src/lib/components/`. New controls should provide clear disabled, pending, error, and keyboard states without changing their label unnecessarily.
