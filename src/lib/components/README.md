# Shared interface components

Both friend and computer games use the same board, artwork, menus, dialogs, and export interface.

`AutoplayTesseract` runs local Easy self-play in a worker, with camera/move animation and pause cleanup. `GameOutcome` presents results and fresh win/checkmate effects. `InspectionHint` provides device-appropriate controls and screen-reader inspection details without adding an inspection panel. `Spinner` standardizes loading; `MovesPanel` pairs the move list with its export icon. Export dialogs support outside-click dismissal.

`SideToggle` is the shared White/Black radio group. `ChessBoard` defaults to match rules; its explicit `practice` mode uses movement geometry for either color without turn or king-safety restrictions. Practice never changes saved matches.

`AxisGizmo` shows XYZ orientation using the same camera as its parent projection. W remains a labelled, dashed connection between cubes.

| Component          | Responsibility                                                                  |
| ------------------ | ------------------------------------------------------------------------------- |
| `Button`           | Native button attributes, primary/default appearance, disabled state.           |
| `SelectField`      | Labelled, typed selection control with a bindable value.                        |
| `GameHeader`       | Product heading or home link and contextual controls.                           |
| `GameMenu`         | Options menu, close behavior, and focus restoration.                            |
| `Modal`            | Native modal dialog, title, and open/close methods.                             |
| `GameStatus`       | Turn, thinking, and result messages with live announcements.                    |
| `RulesDialog`      | The shared movement and outcome reference.                                      |
| `MoveList`         | Presentation of move entries for either mode.                                   |
| `MoveHistory`      | Convex pagination around `MoveList` for friend games.                           |
| `ExportGame`       | Snapshot loading, 4D PGN generation, copying, and downloading.                  |
| `ChessBoard`       | Flat boards, selection, keyboard navigation, threat previews, and motion state. |
| `SpatialBoard`     | Rotatable tesseract, projected threats, and piece animation.                    |
| `Piece`            | Shared piece artwork and White/Black styling.                                   |
| `FlatOverlays`     | Cross-board animation and threat arrows.                                        |
| `ThreatSummary`    | Enemy attackers, friendly defenders, and preview legality.                      |
| `AuthProvider`     | Convex authentication context for online match/invitation routes only.          |
| `TesseractMark`    | Shared geometric product mark.                                                  |
| `PlayOption`       | Raised mode card linking to friend or computer setup.                           |
| `HowToPlay`        | One target move per lesson and a local free-practice board.                     |
| `GuideProjection`  | Linked 3D/4D teaching diagrams using the game's projection geometry.            |
| `GuideFlatBoards`  | The teaching move in White's flat-board orientation.                            |
| `CoordinateChange` | Labelled before/after coordinates with changed axes emphasized.                 |
| `MovePlayback`     | Play, pause, scrub, and reduced-motion behavior for teaching examples.          |

Edit `src/lib/design.css` for shared color, font, and shape values, and a control's component stylesheet for its layout. See [the design conventions](../../../docs/design-language.md). `layout.css` supplies global typography and layout utilities rather than button, field, dialog, or header styling. Square buttons remain specialized inside `ChessBoard` so their grid geometry and keyboard behavior stay together.

Black pieces use a contrasting light outline when rendered directly on a dark diagram. Board pieces keep their normal dark outlines. The `onDark` prop on `Piece` makes this context explicit. Interactive buttons remain disabled until their client handlers are ready.

Board props are read-only. Selection, inspection, camera position, and animation never change the authoritative position. A move callback requests a transition from its owning page. `motion.ts` describes the shared animation payload; it is presentation state, not game state.

Game rules, threat analysis, search, and export formatting live in `src/lib/chess/`. The computer search runs in a worker. Online identity and mutation handling remain outside the board components.
