#!/usr/bin/env node

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const {
  ProjectApiError,
  ProjectIndexService,
} = require('./records/project-index.js');

const HOST = '127.0.0.1';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SECURITY_HEADERS = Object.freeze({
  'Content-Security-Policy': "default-src 'self'; img-src 'self' blob: data:; style-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Cache-Control': 'no-store',
});

function parseArguments(argv) {
  const values = {};
  for (let index = 0; index < argv.length;) {
    const key = argv[index];
    if (!key || !key.startsWith('--')) {
      throw new Error('Invalid dashboard server arguments.');
    }
    if (key === '--save-port') {
      values['save-port'] = true;
      index += 1;
      continue;
    }
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new Error('Invalid dashboard server arguments.');
    }
    values[key.slice(2)] = value;
    index += 2;
  }
  const port = Number(values.port);
  if (!path.isAbsolute(values.directory || '')
      || !UUID.test(values['instance-id'] || '')
      || !Number.isInteger(port)
      || port < 0
      || port > 65535
      || typeof values.version !== 'string'
      || values.version.length === 0) {
    throw new Error('Invalid dashboard server arguments.');
  }
  return {
    directory: values.directory,
    instanceId: values['instance-id'],
    port,
    savePort: Object.hasOwn(values, 'save-port'),
    version: values.version,
  };
}

function writeJsonAtomic(filePath, value) {
  const temporaryPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`,
  );
  fs.writeFileSync(temporaryPath, JSON.stringify(value), { encoding: 'utf8', flag: 'wx' });
  try {
    fs.renameSync(temporaryPath, filePath);
  } catch (error) {
    try {
      fs.unlinkSync(temporaryPath);
    } catch {
      // The temporary file may already have been moved.
    }
    throw error;
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function unlinkOwned(filePath, instanceId) {
  try {
    const value = readJson(filePath);
    if (value && value.instance_id === instanceId) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      // Never remove state whose ownership cannot be established.
    }
  }
}

function sendParent(message) {
  if (typeof process.send === 'function' && process.connected) {
    process.send(message, () => process.disconnect());
  }
}

function sendJson(request, response, status, value, extraHeaders = {}) {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    ...SECURITY_HEADERS,
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    ...extraHeaders,
  });
  response.end(request.method === 'HEAD' ? undefined : body);
}

function sendEmpty(response, status, extraHeaders = {}) {
  response.writeHead(status, {
    ...SECURITY_HEADERS,
    'Content-Length': 0,
    ...extraHeaders,
  });
  response.end();
}

function sendError(request, response, status, code, message, extraHeaders = {}) {
  sendJson(request, response, status, { error: { code, message } }, extraHeaders);
}

function parseRequestTarget(rawTarget) {
  if (typeof rawTarget !== 'string'
      || !rawTarget.startsWith('/')
      || rawTarget.startsWith('//')
      || rawTarget.includes('%')
      || rawTarget.includes('\\')
      || rawTarget.includes('\0')
      || rawTarget.split(/[/?#]/).includes('..')) {
    throw new ProjectApiError('request-target-invalid', '요청 경로가 올바르지 않습니다.', 400);
  }
  try {
    return new URL(rawTarget, 'http://127.0.0.1');
  } catch (error) {
    throw new ProjectApiError('request-target-invalid', '요청 경로가 올바르지 않습니다.', 400, error);
  }
}

function validateRequestBoundary(request) {
  const expectedHost = `${HOST}:${request.socket.localPort}`;
  const expectedOrigin = `http://${expectedHost}`;
  const origin = request.headers.origin;
  const rawHeaders = Array.isArray(request.rawHeaders) ? request.rawHeaders : [];
  let hostFieldCount = 0;
  for (let index = 0; index < rawHeaders.length; index += 2) {
    if (String(rawHeaders[index]).toLowerCase() === 'host') {
      hostFieldCount += 1;
    }
  }
  if (hostFieldCount !== 1 || request.headers.host !== expectedHost) {
    return {
      error: { code: 'host-forbidden', message: 'Host가 허용되지 않습니다.', status: 403 },
    };
  }
  if (origin !== undefined && origin !== expectedOrigin) {
    return {
      error: { code: 'origin-forbidden', message: 'Origin이 허용되지 않습니다.', status: 403 },
    };
  }
  return { expectedOrigin, origin };
}

function createRequestHandler(options) {
  const service = options.projectService || new ProjectIndexService({
    registryOptions: options.registryOptions,
    now: options.now,
  });

  return (request, response) => {
    const boundary = validateRequestBoundary(request);
    if (boundary.error) {
      sendError(
        request,
        response,
        boundary.error.status,
        boundary.error.code,
        boundary.error.message,
      );
      return;
    }
    const { expectedOrigin, origin } = boundary;
    if (!new Set(['GET', 'HEAD', 'DELETE']).has(request.method)) {
      sendError(request, response, 405, 'method-not-allowed', '허용되지 않은 method입니다.', {
        Allow: 'GET, HEAD, DELETE',
      });
      return;
    }
    if (request.method === 'DELETE' && origin !== expectedOrigin) {
      sendError(request, response, 403, 'origin-required', 'DELETE에는 동일 Origin이 필요합니다.');
      return;
    }

    let target;
    try {
      target = parseRequestTarget(request.url);
      if (target.hash) {
        throw new ProjectApiError('request-target-invalid', '요청 경로가 올바르지 않습니다.', 400);
      }
    } catch (error) {
      sendError(request, response, error.status || 400, error.code || 'request-target-invalid', error.message);
      return;
    }

    try {
      if ((request.method === 'GET' || request.method === 'HEAD')
          && target.pathname === '/api/v1/health'
          && target.search === '') {
        sendJson(request, response, 200, {
          schema_version: 1,
          instance_id: options.instanceId,
          version: options.version,
        });
        return;
      }

      if ((request.method === 'GET' || request.method === 'HEAD')
          && target.pathname === '/api/v1/projects'
          && target.search === '') {
        sendJson(request, response, 200, { projects: service.listProjects() });
        return;
      }

      const indexMatch = target.pathname.match(/^\/api\/v1\/projects\/([0-9a-f-]+)\/index$/i);
      if ((request.method === 'GET' || request.method === 'HEAD') && indexMatch) {
        if (target.search !== '' && target.search !== '?refresh=1') {
          throw new ProjectApiError('query-invalid', '허용되지 않은 query입니다.', 400);
        }
        sendJson(request, response, 200, service.getIndex(indexMatch[1], {
          refresh: target.search === '?refresh=1',
        }));
        return;
      }

      const documentMatch = target.pathname.match(
        /^\/api\/v1\/projects\/([0-9a-f-]+)\/documents\/(issue|plan|spec)\/([A-Z]+-\d{4,})$/,
      );
      if ((request.method === 'GET' || request.method === 'HEAD')
          && documentMatch
          && target.search === '') {
        sendJson(request, response, 200, service.getDocument(
          documentMatch[1],
          documentMatch[2],
          documentMatch[3],
        ));
        return;
      }

      const deleteMatch = target.pathname.match(/^\/api\/v1\/projects\/([0-9a-f-]+)$/i);
      if (request.method === 'DELETE' && deleteMatch && target.search === '') {
        service.forgetUnavailableProject(deleteMatch[1]);
        sendEmpty(response, 204);
        return;
      }

      sendError(request, response, 404, 'not-found', 'Not found.');
    } catch (error) {
      if (error instanceof ProjectApiError) {
        sendError(request, response, error.status, error.code, error.message);
        return;
      }
      sendError(request, response, 500, 'internal-error', '요청을 처리하지 못했습니다.');
    }
  };
}

function endSocketJson(socket, statusLine, value, extraHeaders = {}) {
  if (!socket.writable || socket.destroyed) {
    socket.destroy();
    return;
  }
  const body = JSON.stringify(value);
  const headers = [
    `HTTP/1.1 ${statusLine}`,
    'Connection: close',
    `Content-Security-Policy: ${SECURITY_HEADERS['Content-Security-Policy']}`,
    `X-Content-Type-Options: ${SECURITY_HEADERS['X-Content-Type-Options']}`,
    `Cache-Control: ${SECURITY_HEADERS['Cache-Control']}`,
    'Content-Type: application/json; charset=utf-8',
    `Content-Length: ${Buffer.byteLength(body)}`,
    ...Object.entries(extraHeaders).map(([name, headerValue]) => `${name}: ${headerValue}`),
    '',
    '',
  ].join('\r\n');
  try {
    socket.end(Buffer.concat([Buffer.from(headers, 'ascii'), Buffer.from(body, 'utf8')]));
  } catch {
    socket.destroy();
  }
}

function createDashboardHttpServer(options) {
  const server = http.createServer(
    { requireHostHeader: false },
    createRequestHandler(options),
  );
  server.on('clientError', (_error, socket) => {
    endSocketJson(socket, '400 Bad Request', {
      error: {
        code: 'request-target-invalid',
        message: '요청 경로가 올바르지 않습니다.',
      },
    });
  });
  server.on('connect', (request, socket) => {
    const boundary = validateRequestBoundary(request);
    if (boundary.error) {
      endSocketJson(socket, '403 Forbidden', {
        error: {
          code: boundary.error.code,
          message: boundary.error.message,
        },
      });
      return;
    }
    endSocketJson(socket, '405 Method Not Allowed', {
      error: {
        code: 'method-not-allowed',
        message: '허용되지 않은 method입니다.',
      },
    }, { Allow: 'GET, HEAD, DELETE' });
  });
  return server;
}

function startServer(options) {
  const settingsPath = path.join(options.directory, 'settings.json');
  const statePath = path.join(options.directory, 'server.json');
  const lockPath = path.join(options.directory, 'server-start.lock');
  let closing = false;
  let ready = false;

  const cleanup = () => {
    unlinkOwned(statePath, options.instanceId);
    unlinkOwned(lockPath, options.instanceId);
  };

  const server = createDashboardHttpServer({
    instanceId: options.instanceId,
    version: options.version,
    registryOptions: options.registryOptions,
  });

  const shutdown = (exitCode = 0) => {
    if (closing) {
      return;
    }
    closing = true;
    const fallback = setTimeout(() => {
      cleanup();
      process.exit(exitCode);
    }, 1000);
    fallback.unref();
    server.close(() => {
      cleanup();
      process.exit(exitCode);
    });
    if (!ready) {
      cleanup();
    }
  };

  server.on('error', (error) => {
    cleanup();
    sendParent({
      ok: false,
      reason: error.code === 'EADDRINUSE' ? 'port-unavailable' : 'start-failed',
    });
    process.exitCode = 1;
  });

  server.listen({ host: HOST, port: options.port, exclusive: true }, () => {
    try {
      const address = server.address();
      const port = address.port;
      fs.mkdirSync(options.directory, { recursive: true });
      if (options.savePort) {
        writeJsonAtomic(settingsPath, { schema_version: 1, port });
      }
      writeJsonAtomic(statePath, {
        schema_version: 1,
        instance_id: options.instanceId,
        pid: process.pid,
        port,
        version: options.version,
        started_at: new Date().toISOString(),
      });
      ready = true;
      unlinkOwned(lockPath, options.instanceId);
      sendParent({ ok: true, pid: process.pid, port });
    } catch (error) {
      cleanup();
      sendParent({ ok: false, reason: 'state-write-failed' });
      server.close(() => {
        process.exitCode = 1;
      });
    }
  });

  process.once('SIGINT', () => shutdown(0));
  process.once('SIGTERM', () => shutdown(0));
  process.once('SIGHUP', () => shutdown(0));
  process.once('exit', cleanup);
  process.once('uncaughtException', () => shutdown(1));
  process.once('unhandledRejection', () => shutdown(1));
  return server;
}

if (require.main === module) {
  try {
    startServer(parseArguments(process.argv.slice(2)));
  } catch (error) {
    sendParent({ ok: false, reason: 'invalid-arguments' });
    process.stderr.write(`Proofline dashboard server failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  HOST,
  SECURITY_HEADERS,
  createDashboardHttpServer,
  createRequestHandler,
  parseArguments,
  parseRequestTarget,
  startServer,
};
