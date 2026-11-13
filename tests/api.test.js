const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const server = require('../src/server.js');

/**
 * In-memory HTTP Mock Dispatcher
 * Calls the HTTP request listener directly without opening TCP sockets,
 * perfectly bypassing sandbox network restrictions while thoroughly testing routes.
 */
function dispatchRequest(method, pathname, postData = null) {
  return new Promise((resolve) => {
    const req = new EventEmitter();
    req.method = method;
    req.url = pathname;
    req.headers = { 'content-type': 'application/json' };

    let resBody = '';
    let resStatus = 200;
    let resHeaders = {};

    const res = {
      writeHead: (status, headers) => {
        resStatus = status;
        resHeaders = headers;
      },
      end: (data) => {
        if (data) resBody += data;
        let parsed = null;
        try {
          parsed = JSON.parse(resBody);
        } catch (e) {
          parsed = resBody;
        }
        resolve({ status: resStatus, headers: resHeaders, body: parsed });
      }
    };

    // Trigger the server handler
    const handler = server.listeners('request')[0];
    handler(req, res);

    if (postData) {
      req.emit('data', JSON.stringify(postData));
    }
    req.emit('end');
  });
}

describe('Clara Health REST API Integration Tests (PRD Section 10)', () => {
  test('GET /health returns healthy status for all engines', async () => {
    const res = await dispatchRequest('GET', '/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'healthy');
    assert.equal(res.body.engines.deterministic, 'active');
    assert.equal(res.body.engines.guardrails, 'active');
    assert.equal(res.body.engines.ragService, 'active');
  });

  test('GET /api/v1/users/me returns authenticated patient profile', async () => {
    const res = await dispatchRequest('GET', '/api/v1/users/me');
    assert.equal(res.status, 200);
    assert.equal(res.body.name, 'Rajesh Kumar');
    assert.equal(res.body.preferredLanguage, 'hi');
  });

  test('GET /api/v1/documents lists documents in private vault', async () => {
    const res = await dispatchRequest('GET', '/api/v1/documents');
    assert.equal(res.status, 200);
    assert.ok(res.body.total >= 1);
    assert.equal(res.body.documents[0].id, 'doc_apollo_01');
  });

  test('GET /api/v1/documents/:id/results returns extracted biomarkers and bounding boxes', async () => {
    const res = await dispatchRequest('GET', '/api/v1/documents/doc_apollo_01/results');
    assert.equal(res.status, 200);
    assert.equal(res.body.total, 4);
    assert.equal(res.body.results[0].testName, 'Fasting Blood Glucose');
    assert.equal(res.body.results[0].triage.label, 'Optimal');
    assert.ok(res.body.results[0].boundingBox);
  });

  test('PATCH /api/v1/documents/:id/results/:resId verifies low-confidence field (SR-004)', async () => {
    const res = await dispatchRequest(
      'PATCH',
      '/api/v1/documents/doc_apollo_01/results/res_01',
      { value: 102 }
    );
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.verifiedResult.normalizedValue, 102);
    assert.equal(res.body.verifiedResult.verifiedByUser, true);
  });

  test('POST /api/v1/chat/messages performs grounded Q&A with citations', async () => {
    const res = await dispatchRequest(
      'POST',
      '/api/v1/chat/messages',
      { documentId: 'doc_apollo_01', query: 'What is my Total Cholesterol level?' }
    );
    assert.equal(res.status, 200);
    assert.match(res.body.answer, /210 mg\/dL/i);
    assert.ok(res.body.citations.length > 0);
    assert.equal(res.body.citations[0].sourceOffset, 'Page 1, Row 6');
  });

  test('POST /api/v1/chat/messages refuses to speculate on absent data (FR-031)', async () => {
    const res = await dispatchRequest(
      'POST',
      '/api/v1/chat/messages',
      { documentId: 'doc_apollo_01', query: 'What is my Thyroid TSH?' }
    );
    assert.equal(res.status, 200);
    assert.equal(res.body.isRefusal, true);
    assert.match(res.body.answer, /not present in your uploaded medical report/i);
  });

  test('POST /api/v1/chat/messages intercepts acute emergency symptoms (SR-007)', async () => {
    const res = await dispatchRequest(
      'POST',
      '/api/v1/chat/messages',
      { documentId: 'doc_apollo_01', query: 'I have severe chest pain and coughing up blood' }
    );
    assert.equal(res.status, 200);
    assert.equal(res.body.isEmergency, true);
    assert.match(res.body.answer, /EMERGENCY PROTOCOL ACTIVATED/i);
  });

  test('GET /api/v1/doctor-prep generates 5-minute doctor consultation sheet (FR-046)', async () => {
    const res = await dispatchRequest('GET', '/api/v1/doctor-prep?documentId=doc_apollo_01');
    assert.equal(res.status, 200);
    assert.equal(res.body.patientName, 'Rajesh Kumar');
    assert.ok(res.body.prioritizedQuestions.length in [1, 2, 3]);
    assert.match(res.body.clinicalNotice, /does not replace medical consultation/i);
  });

  test('GET /api/v1/health/trends calculates deterministic change over time (FR-024)', async () => {
    const res = await dispatchRequest('GET', '/api/v1/health/trends?test=HbA1c');
    assert.equal(res.status, 200);
    assert.equal(res.body.trend.compatible, true);
    assert.equal(res.body.trend.delta, -0.4);
    assert.equal(res.body.trend.direction, 'decreasing');
  });

  test('GET /api/v1/audit-logs records security events with zero health data (NFR-011)', async () => {
    const res = await dispatchRequest('GET', '/api/v1/audit-logs');
    assert.equal(res.status, 200);
    assert.ok(res.body.total >= 1);
    const log = res.body.logs[0];
    assert.ok(log.userHash);
    assert.ok(log.action);
    assert.equal(log.biomarkers, undefined);
    assert.equal(log.rawText, undefined);
  });
});
