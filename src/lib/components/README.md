# Shared interface components

Both friend and computer games use the same board, artwork, menus, dialogs, and export interface.

| Component       | Responsibility                                                                  |
| --------------- | ------------------------------------------------------------------------------- |
| `Button`        | Native button attributes, primary/default appearance, disabled state.           |
| `SelectField`   | Labelled, typed selection control with a bindable value.                        |
| `GameHeader`    | Product heading or home link and contextual controls.                           |
| `GameMenu`      | Options menu, close behavior, and focus restoration.                            |
| `Modal`         | Native modal dialog, title, and open/close methods.                             |
| `GameStatus`    | Turn, thinking, and result messages with live announcements.                    |
| `RulesDialog`   | The shared movement and outcome reference.                                      |
| `MoveList`      | Presentation of move entries for either mode.                                   |
| `MoveHistory`   | Convex pagination around `MoveList` for friend games.                           |
| `ExportGame`    | Snapshot loading, 4D PGN generation, copying, and downloading.                  |
| `ChessBoard`    | Flat boards, selection, keyboard navigation, threat previews, and motion state. |
| `SpatialBoard`  | Rotatable tesseract, projected threats, and piece animation.                    |
| `Piece`         | Shared piece artwork and White/Black styling.                                   |
| `FlatOverlays`  | Cross-board animation and threat arrows.                                        |
| `ThreatSummary` | Enemy attackers, friendly defenders, and preview legality.                      |
| `AuthProvider`  | Convex authentication context for online match/invitation routes only.          |

Edit a control's component stylesheet to change that control throughout the app. `layout.css` supplies typography and layout utilities rather than button, field, dialog, or header styling. Square buttons remain specialized inside `ChessBoard` so their grid geometry and keyboard behavior stay together.

Board props are read-only. Selection, inspection, camera position, and animation never change the authoritative position. A move callback requests a transition from its owning page. `motion.ts` describes the shared animation payload; it is presentation state, not game state.

Game rules, threat analysis, search, and export formatting live in `src/lib/chess/`. The computer search runs in a worker. Online identity and mutation handling remain outside the board components.
