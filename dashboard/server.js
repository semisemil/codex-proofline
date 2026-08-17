#!/usr/bin/env node

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const HOST = '127.0.0.1';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

  const server = http.createServer((request, response) => {
    if ((request.method === 'GET' || request.method === 'HEAD')
        && request.url === '/api/v1/health') {
      const body = JSON.stringify({
        schema_version: 1,
        instance_id: options.instanceId,
        version: options.version,
      });
      response.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(body),
        'Cache-Control': 'no-store',
      });
      response.end(request.method === 'HEAD' ? undefined : body);
      return;
    }
    const body = JSON.stringify({ error: { code: 'not-found', message: 'Not found.' } });
    response.writeHead(404, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(body),
      'Cache-Control': 'no-store',
    });
    response.end(request.method === 'HEAD' ? undefined : body);
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

module.exports = { HOST, parseArguments, startServer };
