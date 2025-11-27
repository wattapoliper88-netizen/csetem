const fetch = require('node-fetch');
const url = process.argv[2] || 'http://localhost:3000/health';

async function ping() {
  try {
    const start = Date.now();
    const res = await fetch(url);
    const time = Date.now() - start;
    const body = await res.json().catch(() => null);
    console.log(`Pinged ${url} status=${res.status} time=${time}ms body=${JSON.stringify(body)}`);
  } catch (err) {
    console.error('Failed to ping', url, err.toString());
  }
}

ping();
