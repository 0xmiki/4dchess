# Interface components

`ChessBoard` coordinates flat boards, selection, legal moves, inspection, and animation. `SpatialBoard` renders the matching tesseract projection. Both share piece artwork and motion helpers.

- `PlayerProfile`, `TurnIndicator`, and `GameOutcome` present players and game state.
- `MoveHistory` loads paginated online history; `MoveList` also supports local computer games.
- `MovesPanel` groups history and export; `ExportGame` creates 4D PGN snapshots.
- `HowToPlay` uses the real board for lessons and free practice.
- `AutoplayTesseract` runs the landing demo through a local search worker.
- `Button`, `SelectField`, `SideToggle`, `Modal`, and `Spinner` provide shared controls.
- `Logo` and `HomeLink` provide branding and guarded home navigation.
- `InspectionHint` describes mouse and touch controls while keeping detailed inspection announcements available to screen readers.

Keep rules and persistence outside rendering components. Shared color and spacing values live in `src/lib/design.css`; each component owns its control-specific styles.
