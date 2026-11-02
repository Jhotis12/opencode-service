# interface-design-system Specification

## Purpose

Define the shared visual language of the web interface: original brand assets, semantic tokens, typography, component states, accessible overlays, localized status copy and consistent empty/loading/error treatment.

## Requirements

### Requirement: Original brand identity across surfaces
The system SHALL provide one original brand mark, wordmark and favicon, and SHALL use the same brand component in the login page, navigation, mobile header, minimized chat bubble and browser metadata. The mark references terminal, agent-node and OpenCode concepts without copying the official OpenCode logo.

#### Scenario: Login and navigation show the brand lockup
- **WHEN** the user opens the login page or the application shell
- **THEN** the mark and wordmark render from the shared brand component instead of a text diamond, and the navigation lockup links to the projects page with an accessible name

#### Scenario: Favicon and document metadata identify the product
- **WHEN** the application is opened in a browser tab
- **THEN** the favicon, document title and theme color resolve from the brand assets instead of an empty icon

#### Scenario: Mark remains legible at small sizes
- **WHEN** the mark is rendered at 16, 24 and 40 pixels on a dark surface
- **THEN** its silhouette and accent node remain distinguishable without relying on the wordmark

### Requirement: Semantic color roles
The system SHALL resolve surfaces, lines, text, brand accents, agent accents, status colors and node-category colors from named tokens. Status colors SHALL be used only for state, and node-category colors SHALL be paired with a shape and icon so color is never the only differentiator.

#### Scenario: Running is not presented as a warning
- **WHEN** a run, step or service is in a running or queued state
- **THEN** running uses the informational accent and warning is reserved for degraded or attention states

#### Scenario: Node categories use a bounded palette
- **WHEN** the canvas renders trigger, HTTP, code, transform, delay, validate, agent, decision and approval nodes
- **THEN** each node uses one of five category tokens and remains distinguishable through its silhouette and icon rather than a unique hue per type

#### Scenario: Surfaces do not drift between screens
- **WHEN** cards, inputs, code wells, selected rows and overlays are rendered on different pages
- **THEN** they use the same surface, line and text tokens instead of page-local hex values

### Requirement: Bundled typography and legible scale
The system SHALL load a bundled variable sans font and use a documented type scale. Body text SHALL be 14 px, metadata and badges SHALL be at least 11 px, node titles SHALL be at least 14 px at 100% zoom, and metrics and durations SHALL use tabular numerals.

#### Scenario: Typography does not depend on the workstation
- **WHEN** the application is opened on a machine without the preferred font installed
- **THEN** the bundled font loads and headings, labels, buttons and body text keep their intended metrics

#### Scenario: Metadata remains readable
- **WHEN** a badge, helper text, node subtitle or health metric is rendered
- **THEN** its font size is at least 11 px and its contrast meets the text contrast target

#### Scenario: Long identifiers do not break layout
- **WHEN** a model identifier, agent path, slug or run identifier is longer than its container
- **THEN** it truncates with an accessible full-value title or wraps in a bounded code area without changing card height

### Requirement: Interactive states and focus visibility
Every interactive element SHALL expose hover, pressed, disabled and visible keyboard-focus states. Icon-only controls SHALL have an accessible name, and press feedback SHALL use a subtle scale that does not move surrounding layout.

#### Scenario: Keyboard focus is visible
- **WHEN** the user tabs to a button, link, tab, input or icon-only control
- **THEN** a visible focus ring appears with sufficient contrast against the adjacent surface

#### Scenario: Press feedback confirms the action
- **WHEN** the user presses a button
- **THEN** the control shows a subtle pressed scale before releasing, and the transition respects reduced-motion preferences

#### Scenario: Icon-only controls are understandable
- **WHEN** a control shows only an icon
- **THEN** it exposes an accessible name and a tooltip or title that describes the action

### Requirement: Accessible overlays and off-screen navigation
Modals and drawers SHALL trap keyboard focus, return focus to their trigger when closed, make the background inert and close with Escape. Navigation that is visually off-screen SHALL NOT receive keyboard focus.

#### Scenario: Modal focus stays inside the dialog
- **WHEN** the user tabs through an open modal or node inspector
- **THEN** focus cycles within the dialog and does not reach controls behind the backdrop

#### Scenario: Closing restores focus
- **WHEN** the user closes a modal with Escape, the backdrop or the close control
- **THEN** focus returns to the element that opened it

#### Scenario: Closed navigation is not focusable
- **WHEN** the narrow navigation drawer is closed or the application is in desktop mode
- **THEN** its off-screen links are inert and cannot receive focus

#### Scenario: Skip link reaches the main content
- **WHEN** the user presses Tab on first load
- **THEN** a skip link appears and moves focus to the main content region

### Requirement: Localized status and user-facing copy
User-facing statuses, modes, errors, empty states and architecture descriptions SHALL be presented in Spanish. Raw API values MAY appear only in technical details or accessible titles, and internal architecture terms SHALL NOT appear in primary navigation or headings.

#### Scenario: Run and service statuses are localized
- **WHEN** a run, step, service, integration or health status is shown in a badge or table
- **THEN** the visible label is Spanish while the raw machine value remains available in the title or accessible description

#### Scenario: Agent modes are localized
- **WHEN** an agent card or editor shows its mode
- **THEN** it uses `Principal`, `Sub-agente` or `Principal y sub-agente` instead of raw `primary`, `subagent` or `all`

#### Scenario: Errors are actionable
- **WHEN** an API request fails or a validation error is shown
- **THEN** the message explains what happened and what the user can do next in Spanish instead of exposing an untranslated server message

#### Scenario: Internal architecture is not primary copy
- **WHEN** the navigation, login or page headers describe the product
- **THEN** they do not use internal terms such as "Hexagonal" as user-facing value

### Requirement: Consistent empty, loading and error states
Lists, panels and tabs SHALL use a defined loading state, empty state and error state with an actionable next step. System surfaces SHALL NOT use celebratory emoji as the only signal.

#### Scenario: Empty list explains the next action
- **WHEN** a project, agent, notebook, integration or run list has no items
- **THEN** the interface shows a concise explanation and a primary action to create the first item

#### Scenario: Loading and failure are distinguishable
- **WHEN** a panel is loading or a request fails
- **THEN** the panel shows a dedicated loading or error state instead of rendering an empty successful state

#### Scenario: System copy stays professional
- **WHEN** a health, error or empty system surface is rendered
- **THEN** it uses the shared icon and text language rather than an emoji-only celebration
