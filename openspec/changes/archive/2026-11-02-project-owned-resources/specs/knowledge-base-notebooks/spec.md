# Spec Delta

## MODIFIED Requirements

### Requirement: Document and URL ingestion into Notebooks
The system SHALL allow creating named Notebooks inside a project and ingesting PDF, DOCX, CSV, Markdown, plain text files, and allowlisted HTTP(S) URLs, validating MIME types and file size limits at the boundary and storing extracted content under the owning project's knowledge area.

#### Scenario: Uploading a PDF document to a Notebook
- **WHEN** a user uploads a valid PDF document into a Notebook owned by the current project
- **THEN** the system extracts clean Markdown preserving headings and tables, generates a structured source summary, splits content into chunks with page/section metadata, indexes them, and stores the source under that project's knowledge area

#### Scenario: Blocking SSRF on URL ingestion
- **WHEN** a user or agent submits a URL resolving to a loopback, link-local, or private IP range
- **THEN** the system rejects the URL ingestion with HTTP `422 UNSAFE_URL` before performing any network fetch

#### Scenario: Ingestion into a sibling project's Notebook is denied
- **WHEN** a request scoped to project A attempts to upload a source or URL into a Notebook owned by project B
- **THEN** the system rejects the request with HTTP `403` and does not write any file or index entry

### Requirement: Hybrid semantic and full-text search with source citations
The system SHALL index Notebook chunks using both vector embeddings (`sqlite-vec` or `pgvector`) and full-text search (`FTS5` or `tsvector`), returning ranked excerpts with document title and section/page citations, scoped to the Notebooks owned by the requesting project unless the global orchestrator explicitly searches across projects.

#### Scenario: Sub-agent queries an assigned Notebook
- **WHEN** a sub-agent or workflow node invokes `platform_kb_search` against an assigned Notebook
- **THEN** the system executes hybrid retrieval and returns the top matching chunks along with `sourceId`, `documentTitle`, and `sectionOrPage` citation metadata

#### Scenario: Project search cannot see sibling Notebooks
- **WHEN** a project-scoped search runs without a Notebook filter
- **THEN** the system searches only the Notebooks owned by that project and never returns chunks from a sibling project

#### Scenario: Missing embeddings degrade to full-text search
- **WHEN** the embeddings provider is unavailable
- **THEN** search continues using full-text retrieval and the response indicates the degraded mode without failing the request

### Requirement: Grounded sub-agent binding to Notebooks
The system SHALL allow binding one or more Notebooks owned by the same project to a sub-agent profile or workflow node, injecting the Notebook source summaries into context and enforcing source-grounded responses when `strictGrounding` is enabled.

#### Scenario: Sub-agent answers using bound Notebook with strict grounding
- **WHEN** a sub-agent bound to a Notebook with `strictGrounding = true` receives a question
- **THEN** the sub-agent bases its response strictly on the retrieved Notebook chunks, includes source citations, and states when the information is not present in the Notebook

#### Scenario: Cross-project Notebook binding is rejected
- **WHEN** a sub-agent or workflow node in project A is configured with a Notebook owned by project B
- **THEN** the system rejects the save or run with a clear validation error and does not inject the sibling Notebook's content

#### Scenario: Deleted Notebook is detected before execution
- **WHEN** an agent node references a Notebook that no longer exists in the project
- **THEN** the system fails validation before the first execution step and identifies the missing Notebook

## ADDED Requirements

### Requirement: Project-owned knowledge isolation
The system SHALL make Notebooks, sources, chunks, and knowledge files owned by a single project, and SHALL scope listing, ingestion, search, update, and deletion to that project.

#### Scenario: Sibling project cannot list Notebooks
- **WHEN** a project-scoped request lists Notebooks
- **THEN** it receives only that project's Notebooks and never the Notebooks of a sibling project

#### Scenario: Deleting a project removes its knowledge
- **WHEN** an administrator deletes a project
- **THEN** the project's Notebook metadata, sources, chunks, and knowledge files are removed with the project

#### Scenario: Project agent cannot mutate another project's knowledge
- **WHEN** a project agent invokes a knowledge tool against a Notebook outside its project
- **THEN** the system rejects the operation with HTTP `403` and records the rejected access

### Requirement: Cross-project knowledge search for the global orchestrator
The system SHALL allow the global orchestrator to search knowledge across projects in read-only mode, optionally filtered by project, returning the owning project with every citation.

#### Scenario: Search across all projects
- **WHEN** the administrator asks the global orchestrator a question that spans multiple projects
- **THEN** the orchestrator searches the relevant project Notebooks and returns excerpts tagged with the owning project and source citation

#### Scenario: Search filtered by project
- **WHEN** the administrator asks the orchestrator about one project's knowledge
- **THEN** the search is restricted to that project's Notebooks and results still include the project and source citation

#### Scenario: Orchestrator cannot mutate knowledge
- **WHEN** the global orchestrator attempts to upload, edit, or delete a Notebook or source
- **THEN** the operation is denied because the global scope is read-only for project knowledge
