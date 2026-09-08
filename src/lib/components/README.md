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

`HistoryShortcuts` handles Left/Right history navigation in player and spectator views. Left/Right still navigate history when the tesseract is focused; W/A/S/D rotate it and Home resets its view. Text inputs, open dialogs/menus, modified shortcuts, and other application widgets keep their own keys. In spectator history, Right prefers the real continuation at a fork and returns to live at a variation's end. Only private variations receive the lighter board tint; reviewing actual moves retains normal colors.

History motion animates adjacent positions in either direction. `history-motion` tracks navigation cadence and keyboard repeat separately: rapid taps shorten animations, held-arrow repeats reach instant steps sooner, and a pause restores normal timing. New positions replace in-progress animations instead of queuing. Reduced-motion preferences still disable animation.

Threat inspection uses gameplay colors independent of the site accents. Coral marks opposing attacks and blue marks defenders, relative to the inspected piece or the side to move for an empty square. The flat overlay uses darker shades for contrast with the checkerboard, and masks arrows beneath piece artwork. Flat-board inspection uses arrows without square outlines or full-square washes. Source halos are omitted because one piece can attack one pinned target while defending another.

`GameOverDialog` shows the result once per game on desktop and mobile. It uses the existing outcome wording and only offers supported actions: new game or rematch. Closing it leaves the board available; the Result control opens it again. Starting another round clears the previous dialog. Results enter with a brief fade, lift, and scale animation; reduced-motion preferences disable it.

`WinFireworks` replaces confetti for a transition from an active game to the local player’s scored win. It does not replay when a result is reopened or an already-finished game is loaded, and it does not celebrate losses, draws, or spectator results. Its canvas sits above the modal backdrop while excluding the dialog itself, so effects never obscure or intercept the controls. Particle density, resolution, and frame rate adapt to mobile screens. Animation stops on completion, dialog close, unmount, a hidden tab, or a change to reduced motion. Live game audio uses the selected batch 2 set. `/brand` includes win, loss, draw, and reopen previews.

`MatchSidebar` keeps desktop controls in the sidebar and puts mobile options in a dismissible panel above a fixed navigation bar. `MoveList` registers its available history steps through `match-navigation`; spectators supply their own branch navigation. Waiting friend challenges open the mobile panel so the invitation stays accessible. Player rows surround the flat boards, with the tesseract below on mobile. Rank and file labels are drawn inside edge squares and follow board orientation.

`PieceFlight` renders the flat boards’ Crisp motion: 240 ms within a board, 380 ms between boards, distinct piece arcs, directional warp, and a shallow upward trajectory. The warp stretches at most 1.45× and keeps at least 82% thickness and 96% opacity. There is no bright speed streak. The faint wake is capped at 1.1 squares and fades within 180 ms. The tesseract uses plain projected movement without warp, vapor trails, hops, press scaling, selection lift, or landing bounce; its selection and legal-move markers remain. On the flat boards, `Piece` provides press feedback, a stable selection lift and one landing settle. There is no landing ripple or hover scaling. Reduced-motion preferences disable travel and reactions.

`GameAudio` observes authoritative live positions separately from the displayed history board. It deduplicates moves and endings, waits for matching move metadata, suppresses replayed/history sounds, and announces the local low-clock threshold once per game. `SoundControls` stores mute and volume locally. The audio context unlocks on user interaction; a fresh game-start cue can wait for that first interaction, while old moves never queue. Computer play, player rooms, spectators and lessons share this system. `/brand` previews the same board and selected sounds; the experiment route and alternative sets were removed.

`MotionControls` provides a persistent motion-effects toggle in board controls, lessons, and `/brand`. The OS reduced-motion preference always overrides it. Turning effects off makes board moves instant, removes piece reactions and trails, suppresses automatic homepage orbiting, and disables result entrance/celebration animations. Sound settings stay independent.
