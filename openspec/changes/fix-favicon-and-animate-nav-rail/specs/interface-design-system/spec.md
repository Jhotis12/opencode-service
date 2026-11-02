# Spec Delta

## MODIFIED Requirements

### Requirement: Original brand identity across surfaces
The system SHALL provide one original brand mark, wordmark and favicon, and SHALL use the same brand component in the login page, navigation, mobile header, minimized chat bubble and browser metadata. The mark references terminal, agent-node and OpenCode concepts without copying the official OpenCode logo.

#### Scenario: Login and navigation show the brand lockup
- **WHEN** the user opens the login page or the application shell
- **THEN** the mark and wordmark render from the shared brand component instead of a text diamond, and the navigation lockup links to the projects page with an accessible name

#### Scenario: Favicon and document metadata identify the product
- **WHEN** the application is opened in a browser tab
- **THEN** the favicon, document title and theme color resolve from the brand assets instead of an empty icon

#### Scenario: Built application serves the brand assets
- **WHEN** the production web build is served by the backend
- **THEN** `/favicon.svg` and the `/brand/*.svg` assets return their SVG files with an `image/svg+xml` content type instead of the SPA HTML fallback

#### Scenario: Mark remains legible at small sizes
- **WHEN** the mark is rendered at 16, 24 and 40 pixels on a dark surface
- **THEN** its silhouette and accent node remain distinguishable without relying on the wordmark
