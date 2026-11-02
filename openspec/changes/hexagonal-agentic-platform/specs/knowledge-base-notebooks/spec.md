# Spec Delta

## Purpose

Proporciona bancos de información estilo Google NotebookLM ("Notebooks") donde el usuario carga documentos o URLs para indexarlos semántica y textualmente, generar resúmenes automáticos y fundamentar ("entrenar") las respuestas de sub-agentes y nodos con citas verificables.

## ADDED Requirements

### Requirement: Document and URL ingestion into Notebooks
The system SHALL allow creating named Notebooks and ingesting PDF, DOCX, CSV, Markdown, plain text files, and allowlisted HTTP(S) URLs, validating MIME types and file size limits at the boundary.

#### Scenario: Uploading a PDF document to a Notebook
- **WHEN** a user uploads a valid PDF document into a Notebook
- **THEN** the system extracts clean Markdown preserving headings and tables, generates a structured source summary, splits content into chunks with page/section metadata, and indexes them

#### Scenario: Blocking SSRF on URL ingestion
- **WHEN** a user or agent submits a URL resolving to a loopback, link-local, or private IP range
- **THEN** the system rejects the URL ingestion with HTTP `422 UNSAFE_URL` before performing any network fetch

### Requirement: Hybrid semantic and full-text search with source citations
The system SHALL index Notebook chunks using both vector embeddings (`sqlite-vec` or `pgvector`) and full-text search (`FTS5` or `tsvector`), returning ranked excerpts with document title and section/page citations.

#### Scenario: Sub-agent queries an assigned Notebook
- **WHEN** a sub-agent or workflow node invokes `platform_kb_search` against an assigned Notebook
- **THEN** the system executes hybrid retrieval and returns the top matching chunks along with `sourceId`, `documentTitle`, and `sectionOrPage` citation metadata

### Requirement: Grounded sub-agent binding to Notebooks
The system SHALL allow binding one or more Notebooks to a sub-agent profile or workflow node, injecting the Notebook source summaries into context and enforcing source-grounded responses when `strictGrounding` is enabled.

#### Scenario: Sub-agent answers using bound Notebook with strict grounding
- **WHEN** a sub-agent bound to a Notebook with `strictGrounding = true` receives a question
- **THEN** the sub-agent bases its response strictly on the retrieved Notebook chunks, includes source citations, and states when the information is not present in the Notebook
