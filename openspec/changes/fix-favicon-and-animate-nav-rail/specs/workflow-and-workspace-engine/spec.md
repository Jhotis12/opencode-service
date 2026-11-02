# Spec Delta

## MODIFIED Requirements

### Requirement: Collapsible global navigation
The system SHALL let the user collapse the global navigation sidebar into an icon rail and expand it again, preserving the active section and remembering the preference. The desktop rail SHALL transition smoothly between its expanded and collapsed widths and SHALL switch instantly when the user requests reduced motion.

#### Scenario: Collapsing and expanding the sidebar
- **WHEN** the user activates the navigation collapse control
- **THEN** the sidebar becomes an icon-only rail, the canvas area expands, and activating the control again restores the labeled sidebar

#### Scenario: Collapse and expand animate the rail
- **WHEN** the user activates the navigation collapse control on a desktop viewport
- **THEN** the rail width and its labels transition smoothly and the workspace reflows with the rail

#### Scenario: Rail content stays contained during the transition
- **WHEN** the rail is between its expanded and collapsed widths
- **THEN** labels and the wordmark are clipped or faded inside the rail and never overlap the workspace

#### Scenario: Reduced motion switches immediately
- **WHEN** the user prefers reduced motion and activates the navigation collapse control
- **THEN** the rail and labels switch to the new state without a width or opacity animation

#### Scenario: Collapsed navigation remains accessible
- **WHEN** the navigation is collapsed
- **THEN** every destination keeps an accessible name and tooltip and remains operable by keyboard

#### Scenario: Preference survives reload
- **WHEN** the user reloads the application or returns later
- **THEN** the sidebar starts in the last state chosen by that user

#### Scenario: Narrow viewport navigation
- **WHEN** the viewport is too narrow for the labeled sidebar
- **THEN** navigation opens as an overlay drawer and closes after the user selects a destination
