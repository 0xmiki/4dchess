# Interface components

`ChessBoard` coordinates flat boards, selection, legal moves, inspection, and animation. `SpatialBoard` renders the matching tesseract projection. Both share piece artwork and motion helpers.

- `PlayerProfile`, `TurnIndicator`, and `GameOutcome` present players and game state.
- `MoveHistory` loads paginated online history; `MoveList` also supports local computer games.
- `MovesPanel` groups history and export; `ExportGame` creates 4D PGN snapshots.
- `HowToPlay` uses the real board for lessons and free practice.
- `AutoplayTesseract` runs the landing demo through a local search worker.
- `Button`, `SelectField`, `SideToggle`, `Modal`, and `Spinner` provide shared controls.
- `Logo` and `HomeLink` provide branding and guarded home navigation.
- `RoomView` resolves player or spectator access on the same room URL. `PlayerRoom` keeps participant controls; `SpectatorRoom` watches public game data and uses `VariationHistory` for private move branches.
- `InspectionHint` describes mouse and touch controls while keeping detailed inspection announcements available to screen readers.
- `BoardControls` puts online board instructions in a sidebar popover. Profile notices occupy fixed overlay slots facing the board, so connection messages do not move the playfield.

Keep rules and persistence outside rendering components. Shared color and spacing values live in `src/lib/design.css`; each component owns its control-specific styles.

For asynchronous button actions, use `Button`'s `loading` prop. Keep the action label unchanged while the shared spinner runs; do not replace it with text such as "Confirming" or "Sending". Loading disables the button and sets `aria-busy`. Controls with an existing icon slot, such as `PlayOption`, may show the spinner in that slot instead.

Spectator moves only update the browser's variation tree. Keep that state separate from live subscriptions and never connect spectator controls to player mutations. Returning to live preserves the tree for the current visit. A rematch follows automatically in live mode; an analysis view stays on its earlier game until the viewer returns to live. Reloading clears local branches.

`HistoryShortcuts` handles Left/Right history navigation in player and spectator views. It leaves text inputs, open dialogs/menus, modified shortcuts, and the focused tesseract's rotation controls alone. In spectator history, Right prefers the real continuation at a fork and returns to live at a variation's end. Only private variations receive the lighter board tint; reviewing actual moves retains normal colors.

History motion animates adjacent positions in either direction. `history-motion` tracks navigation cadence and keyboard repeat separately: rapid taps shorten animations, held-arrow repeats reach instant steps sooner, and a pause restores normal timing. New positions replace in-progress animations instead of queuing. Reduced-motion preferences still disable animation.

Threat inspection uses gameplay colors independent of the site accents. Coral marks opposing attacks and blue marks defenders, relative to the inspected piece or the side to move for an empty square. The flat overlay uses darker shades for contrast with the checkerboard, and masks arrows beneath piece artwork. Flat-board inspection uses arrows without square outlines or full-square washes. Source halos are omitted because one piece can attack one pinned target while defending another.

`GameOverDialog` shows the result once per game on desktop and mobile. It uses the existing outcome wording and only offers supported actions: new game or rematch. Closing it leaves the board available; the Result control opens it again. Starting another round clears the previous dialog. Results enter with a brief fade, lift, and scale animation; reduced-motion preferences disable it.

`WinFireworks` replaces confetti for a transition from an active game to the local player’s scored win. It does not replay when a result is reopened or an already-finished game is loaded, and it does not celebrate losses, draws, or spectator results. Its canvas sits above the modal backdrop while excluding the dialog itself, so effects never obscure or intercept the controls. Particle density, resolution, and frame rate adapt to mobile screens. Animation stops on completion, dialog close, unmount, a hidden tab, or a change to reduced motion. Gameplay remains silent. `/brand` includes win, loss, draw, and reopen previews.

`MatchSidebar` keeps desktop controls in the sidebar and puts mobile options in a dismissible panel above a fixed navigation bar. `MoveList` registers its available history steps through `match-navigation`; spectators supply their own branch navigation. Waiting friend challenges open the mobile panel so the invitation stays accessible. Player rows surround the flat boards, with the tesseract below on mobile. Rank and file labels are drawn inside edge squares and follow board orientation.
