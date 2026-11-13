# Clara Health / MediExplain AI Platform

An AI-powered, patient-first medical report understanding and clinical preparation platform built according to the Product Requirements Document (PRD v1.0) and Brand Guidelines.

---

## Architecture & Core Modules

* **`src/core/deterministic.js`:** Mathematical parser, boundary range evaluation, 4-tier de-panic triage classifier, and compatible longitudinal trend engine.
* **`src/core/guardrails.js`:** Emergency symptom interceptor (`SR-007`), forbidden diagnostic blocker (`SR-001`, `SR-002`), statutory disclaimer appender, and DPDP zero-health-data audit logger.
* **`src/services/extractionService.js`:** Document type classifier, biomarker extractor with confidence scoring and bounding boxes, and human verification handlers (`SR-004`).
* **`src/services/ragService.js`:** Multi-tenant document chunking, grounded QA with citations, and refusal engine when evidence is absent from the report (`FR-031`, `SR-006`).
* **`src/services/doctorPrepService.js`:** 5-minute doctor consultation sheet synthesizing top 3 prioritized questions for clinic visits (`FR-046`).
* **`src/server.js`:** REST API Server implementing all PRD Section 10 routes (`/health`, `/api/v1/documents`, `/api/v1/chat/messages`, etc.).

---

## Running the Automated Test Suite

To run all 34 automated unit and integration tests:

```bash
cd clara-health-platform
npm test
```

Or run individual test suites:
```bash
node --test tests/deterministic.test.js
node --test tests/guardrails.test.js
node --test tests/extraction.test.js
node --test tests/rag.test.js
node --test tests/doctorPrep.test.js
node --test tests/api.test.js
```

---

## Starting the Application Server

```bash
node src/server.js
```
The server will start at `http://localhost:3000` with the live health status at `http://localhost:3000/health`.

