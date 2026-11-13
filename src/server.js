/**
 * Clara Health / MediExplain AI — Core REST API Server (PRD Section 10)
 * Standalone zero-dependency HTTP server with REST endpoints & embedded web app.
 */

const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

const DeterministicEngine = require('./core/deterministic.js');
const GuardrailEngine = require('./core/guardrails.js');
const ExtractionService = require('./services/extractionService.js');
const RAGService = require('./services/ragService.js');
const DoctorPrepService = require('./services/doctorPrepService.js');

const rag = new RAGService();

// In-Memory Database Stores (representing PostgreSQL + MinIO)
const db = {
  users: {
    user_01: {
      id: "user_01",
      name: "Rajesh Kumar",
      age: 58,
      preferredLanguage: "hi",
      timezone: "Asia/Kolkata",
      condition: "Type 2 Care"
    }
  },
  documents: {
    doc_apollo_01: {
      id: "doc_apollo_01",
      userId: "user_01",
      filename: "Apollo_Comprehensive_Metabolic_Panel.pdf",
      mimeType: "application/pdf",
      documentType: "lab_report",
      status: "processed",
      uploadedAt: "2026-10-28T09:30:00Z",
      checksum: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    }
  },
  results: {
    doc_apollo_01: [
      {
        id: "res_01",
        documentId: "doc_apollo_01",
        testName: "Fasting Blood Glucose",
        originalValue: 104,
        originalUnit: "mg/dL",
        referenceRange: "70 - 110",
        confidence: 0.98,
        verifiedByUser: true,
        requiresUserConfirmation: false,
        triage: { tier: 1, label: "Optimal", badge: "Healthy / Normal", color: "emerald" },
        boundingBox: { x: 40, y: 120, width: 500, height: 26 },
        sourceOffset: "Page 1, Row 4"
      },
      {
        id: "res_02",
        documentId: "doc_apollo_01",
        testName: "HbA1c (Glycated Hb)",
        originalValue: 6.8,
        originalUnit: "%",
        referenceRange: "< 5.7",
        confidence: 0.96,
        verifiedByUser: true,
        requiresUserConfirmation: false,
        triage: { tier: 2, label: "Expected Variance", badge: "Mild / Borderline Fluctuation", color: "teal" },
        boundingBox: { x: 40, y: 155, width: 500, height: 26 },
        sourceOffset: "Page 1, Row 5"
      },
      {
        id: "res_03",
        documentId: "doc_apollo_01",
        testName: "Total Cholesterol",
        originalValue: 210,
        originalUnit: "mg/dL",
        referenceRange: "< 200",
        confidence: 0.94,
        verifiedByUser: true,
        requiresUserConfirmation: false,
        triage: { tier: 2, label: "Expected Variance", badge: "Mild / Borderline Fluctuation", color: "amber" },
        boundingBox: { x: 40, y: 190, width: 500, height: 26 },
        sourceOffset: "Page 1, Row 6"
      },
      {
        id: "res_04",
        documentId: "doc_apollo_01",
        testName: "Serum Creatinine",
        originalValue: 0.9,
        originalUnit: "mg/dL",
        referenceRange: "0.7 - 1.2",
        confidence: 0.99,
        verifiedByUser: true,
        requiresUserConfirmation: false,
        triage: { tier: 1, label: "Optimal", badge: "Healthy / Normal", color: "emerald" },
        boundingBox: { x: 40, y: 225, width: 500, height: 26 },
        sourceOffset: "Page 1, Row 7"
      }
    ]
  },
  auditLogs: []
};

// Seed initial document chunks into RAG Service
rag.indexDocument("doc_apollo_01", [
  { text: "Fasting Blood Glucose: 104 mg/dL, Standard Interval: 70 - 110 mg/dL", pageNumber: 1, sourceOffset: "Page 1, Row 4" },
  { text: "HbA1c (Glycated Hemoglobin): 6.8 %, Target Benchmark: < 5.7 %", pageNumber: 1, sourceOffset: "Page 1, Row 5" },
  { text: "Total Cholesterol: 210 mg/dL, Standard Reference Range: < 200 mg/dL. HDL: 54 mg/dL (Optimal).", pageNumber: 1, sourceOffset: "Page 1, Row 6" },
  { text: "Serum Creatinine: 0.9 mg/dL, Standard Reference Range: 0.7 - 1.2 mg/dL. Optimal renal filtration.", pageNumber: 1, sourceOffset: "Page 1, Row 7" }
]);

const PORT = process.env.PORT || 3000;

function sendJSON(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(payload, null, 2));
}

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // Handle CORS Preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    return res.end();
  }

  // 0. Serve Dashboard Frontend (GET / or GET /index.html)
  if ((pathname === '/' || pathname === '/index.html') && method === 'GET') {
    const indexPath = path.join(__dirname, '..', 'public', 'index.html');
    if (fs.existsSync(indexPath)) {
      const html = fs.readFileSync(indexPath, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(html);
    }
  }

  // 1. Health Endpoint
  if (pathname === '/health' && method === 'GET') {
    return sendJSON(res, 200, {
      status: "healthy",
      service: "Clara Health / MediExplain AI",
      timestamp: new Date().toISOString(),
      engines: {
        deterministic: "active",
        guardrails: "active",
        ragService: "active",
        auditLogger: "active"
      }
    });
  }

  // 2. User Profile Endpoint (GET /api/v1/users/me)
  if (pathname === '/api/v1/users/me' && method === 'GET') {
    return sendJSON(res, 200, db.users.user_01);
  }

  // 3. Document Vault List (GET /api/v1/documents)
  if (pathname === '/api/v1/documents' && method === 'GET') {
    const list = Object.values(db.documents);
    return sendJSON(res, 200, { total: list.length, documents: list });
  }

  // 4. Upload Document (POST /api/v1/documents)
  if (pathname === '/api/v1/documents' && method === 'POST') {
    const body = await parseBody(req);
    const newDocId = `doc_${Date.now()}`;
    const filename = body.filename || "Uploaded_Lab_Report.pdf";
    const rawLines = body.rawLines || [
      "Fasting Blood Glucose 104 mg/dL 70 - 110",
      "Total Cholesterol 210 mg/dL < 200"
    ];

    const docRecord = {
      id: newDocId,
      userId: "user_01",
      filename: filename,
      mimeType: "application/pdf",
      documentType: ExtractionService.classifyDocumentType(rawLines.join(" ")),
      status: "processed",
      uploadedAt: new Date().toISOString()
    };

    db.documents[newDocId] = docRecord;
    const extracted = ExtractionService.extractBiomarkers(newDocId, rawLines);
    db.results[newDocId] = extracted;

    // Index chunks into RAG
    rag.indexDocument(newDocId, rawLines.map((t, idx) => ({ text: t, pageNumber: 1, sourceOffset: `Row ${idx + 1}` })));

    // Record safe audit log
    db.auditLogs.push(GuardrailEngine.createSafeAuditPayload("user_01", "UPLOAD_DOCUMENT", newDocId));

    return sendJSON(res, 201, {
      document: docRecord,
      extractedCount: extracted.length,
      results: extracted
    });
  }

  // 5. Get Extracted Results (GET /api/v1/documents/:id/results)
  const resultsMatch = pathname.match(/^\/api\/v1\/documents\/([^/]+)\/results$/);
  if (resultsMatch && method === 'GET') {
    const docId = resultsMatch[1];
    const results = db.results[docId] || [];
    return sendJSON(res, 200, { documentId: docId, total: results.length, results: results });
  }

  // 6. User Verification of Extracted Field (PATCH /api/v1/documents/:id/results/:resultId)
  const patchMatch = pathname.match(/^\/api\/v1\/documents\/([^/]+)\/results\/([^/]+)$/);
  if (patchMatch && method === 'PATCH') {
    const docId = patchMatch[1];
    const resId = patchMatch[2];
    const body = await parseBody(req);

    const docResults = db.results[docId] || [];
    const targetIdx = docResults.findIndex(r => r.id === resId);

    if (targetIdx === -1) {
      return sendJSON(res, 404, { error: "Result not found" });
    }

    const updated = ExtractionService.verifyResultField(docResults[targetIdx], body);
    db.results[docId][targetIdx] = updated;

    db.auditLogs.push(GuardrailEngine.createSafeAuditPayload("user_01", "VERIFY_RESULT", resId));
    return sendJSON(res, 200, { success: true, verifiedResult: updated });
  }

  // 7. Grounded Chatbot QA (POST /api/v1/chat/messages)
  if (pathname === '/api/v1/chat/messages' && method === 'POST') {
    const body = await parseBody(req);
    const docId = body.documentId || "doc_apollo_01";
    const query = body.query || "";

    const response = await rag.askReport(docId, query);
    db.auditLogs.push(GuardrailEngine.createSafeAuditPayload("user_01", "CHAT_QUERY", docId));
    return sendJSON(res, 200, response);
  }

  // 8. 5-Minute Doctor Visit Prep (GET /api/v1/doctor-prep)
  if (pathname === '/api/v1/doctor-prep' && method === 'GET') {
    const docId = parsedUrl.query.documentId || "doc_apollo_01";
    const verified = db.results[docId] || [];
    const sheet = DoctorPrepService.generateConsultationSheet(db.users.user_01, verified);
    return sendJSON(res, 200, sheet);
  }

  // 9. Health Trends (GET /api/v1/health/trends)
  if (pathname === '/api/v1/health/trends' && method === 'GET') {
    const testName = parsedUrl.query.test || "HbA1c";
    // Returns verified longitudinal timeline with deterministic deltas
    const history = [
      { date: "2026-04-12", value: 7.2, unit: "%", status: "above_supplied_range" },
      { date: "2026-07-15", value: 7.0, unit: "%", status: "above_supplied_range" },
      { date: "2026-10-28", value: 6.8, unit: "%", status: "above_supplied_range" }
    ];
    const trend = DeterministicEngine.calculateTrend(history[0], history[2]);
    return sendJSON(res, 200, { testName, history, trend });
  }

  // 10. Audit Logs (GET /api/v1/audit-logs)
  if (pathname === '/api/v1/audit-logs' && method === 'GET') {
    return sendJSON(res, 200, { total: db.auditLogs.length, logs: db.auditLogs });
  }

  // Default: Fallback 404
  return sendJSON(res, 404, { error: "Route not found", path: pathname });
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Clara Health Platform API Server running at http://localhost:${PORT}`);
    console.log(`Health endpoint: http://localhost:${PORT}/health`);
  });
}

module.exports = server;

