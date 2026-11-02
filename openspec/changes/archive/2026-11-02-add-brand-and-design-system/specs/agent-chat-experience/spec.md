# Spec Delta

## REMOVED Requirements

### Requirement: Adaptive chat surface
**Reason**: The expanded/maximized surface duplicates the lateral drawer, adds a second focus and persistence model, and no longer has a product purpose. Mobile adaptation is explicitly out of scope for this change.
**Migration**: Use the project chat drawer to open the conversation and the minimize/close controls to dismiss it. There is no expand or full-screen action; the drawer is the maximum chat surface.

### Requirement: Accessible and responsive chat interaction
**Reason**: The old requirement includes the removed expand control and mobile breakpoints that this change no longer targets.
**Migration**: Keyboard and screen-reader access is preserved in the new desktop accessibility requirement, covering input, send, minimize/close, copy and jump-to-latest actions.

### Requirement: Chat drawer that preserves canvas space
**Reason**: The expansion scenario is removed because the drawer is now the maximum surface; the opening and closing behavior is preserved in the new drawer requirement.
**Migration**: Open the chat from the project header and close or minimize it to restore the canvas. No expand action is offered.

## ADDED Requirements

### Requirement: Docked and minimized chat surface
The project chat SHALL support a docked drawer state and a minimized bubble state on desktop. The expanded or maximized state is removed and SHALL NOT be offered. Mobile adaptation is not an acceptance target for this change.

#### Scenario: Docked chat as a lateral drawer
- **WHEN** the user opens the project chat
- **THEN** it opens in the lateral drawer with the persisted conversation and input draft without covering the entire desktop viewport

#### Scenario: Minimizing the chat
- **WHEN** the user minimizes the chat
- **THEN** it collapses into a bubble that shows new-response status and can restore the panel with the same conversation state

#### Scenario: No expanded or maximized state
- **WHEN** the user inspects the chat controls
- **THEN** there is no expand or maximize action, no full-screen chat surface and no persisted expanded state

#### Scenario: State survives navigation
- **WHEN** the user navigates away from the project and returns
- **THEN** the chat restores the last docked or minimized state for that project and loads the persisted conversation

### Requirement: Accessible desktop chat interaction
The chat SHALL be keyboard accessible, announce loading and error states, and remain usable at supported desktop viewports. Mobile responsiveness is not an acceptance target for this change.

#### Scenario: Keyboard-only operation
- **WHEN** a user navigates the chat with the keyboard
- **THEN** the input, send action, minimize or close action, copy actions and jump-to-latest action are reachable and operable with visible focus

#### Scenario: Screen reader announcement
- **WHEN** an agent reply arrives or an error occurs
- **THEN** the chat announces the new state through an appropriate live region without reading the entire history

#### Scenario: Desktop viewport remains usable
- **WHEN** the project page is rendered at 1280 px or 1440 px
- **THEN** the chat surface, tables, code blocks and input remain usable without horizontal page overflow

### Requirement: Project chat drawer
The project chat SHALL open from the project header as a lateral drawer and SHALL be closed by default so the canvas remains full width until the user opens it.

#### Scenario: Opening the project chat
- **WHEN** the user activates the project's agent action
- **THEN** the chat opens in a lateral drawer with its persisted thread and history

#### Scenario: Closing the project chat
- **WHEN** the user closes or minimizes the drawer
- **THEN** the canvas regains the full width and the conversation remains persisted for the next open

#### Scenario: The drawer is the maximum chat surface
- **WHEN** the project chat is open
- **THEN** the drawer remains bounded by its maximum width and there is no separate full-screen expansion action

### Requirement: Chat scroll affordance
The chat SHALL show a jump-to-latest control when the user is not at the bottom of the conversation, and the control SHALL NOT cover the last message or the composer.

#### Scenario: Jump control appears away from the bottom
- **WHEN** the user scrolls up while a long conversation is open
- **THEN** a jump-to-latest control appears in a dedicated area that does not overlap message text or the composer

#### Scenario: Jump control returns to the latest message
- **WHEN** the user activates the jump-to-latest control
- **THEN** the conversation scrolls to the newest message and the control hides once the bottom is reached

#### Scenario: Incoming reply does not steal position
- **WHEN** a long agent reply arrives while the user is reading earlier messages
- **THEN** the viewport stays at the user's current position and the jump-to-latest control indicates that new content is available
