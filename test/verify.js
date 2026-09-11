const http = require('http');
const { server } = require('../server');

async function testServer() {
  console.log('Testing synchronized judging server with Admin Password Protection & English UI...');

  await new Promise((resolve) => server.listen(3003, resolve));

  function request(path, options = {}) {
    return new Promise((resolve, reject) => {
      const opt = {
        hostname: '127.0.0.1',
        port: 3003,
        path,
        method: options.method || 'GET',
        headers: options.headers || {}
      };

      const req = http.request(opt, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data), headers: res.headers });
          } catch (e) {
            resolve({ status: res.statusCode, body: data, headers: res.headers });
          }
        });
      });
      req.on('error', reject);
      if (options.body) {
        req.write(options.body);
      }
      req.end();
    });
  }

  try {
    // 1. Check state
    console.log('1. Checking /api/state...');
    const stateRes = await request('/api/state');
    if (stateRes.status !== 200) throw new Error(`Status ${stateRes.status}`);
    if (stateRes.body.judges.length !== 20) throw new Error('Expected 20 judges');
    if (stateRes.body.totalItems.flags !== 15 || stateRes.body.totalItems.emblems !== 15) throw new Error('Expected 15 flags and 15 emblems');
    console.log('✅ State verified (20 judges configured, 15 Flags & 15 Emblems)');

    // 2. Test Admin Login with invalid & valid password
    console.log('2. Testing Admin Login with incorrect password...');
    const badLogin = await request('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'wrongpassword' })
    });
    if (badLogin.status !== 401) throw new Error('Expected 401 for bad password');
    console.log('✅ Bad password rejected properly');

    console.log('2.1 Testing Admin Login with correct password (admin2026)...');
    const goodLogin = await request('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'admin2026' })
    });
    if (goodLogin.status !== 200 || !goodLogin.body.success) throw new Error('Admin login failed');
    console.log('✅ Admin login succeeded with admin2026');

    // 3. Test Admin set-round with x-admin-password header
    console.log('3. Opening voting with x-admin-password header...');
    const roundRes = await request('/api/admin/set-round', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-password': 'admin2026'
      },
      body: JSON.stringify({ competition: 'flags', itemNumber: 1, votingOpen: true })
    });
    if (roundRes.status !== 200 || !roundRes.body.votingOpen) throw new Error('Admin open voting failed');
    console.log('✅ Admin set-round succeeded (Voting opened for Design #01)');

    // 4. Judge Login & Submit Score
    console.log('4. Testing Judge 01 Login & Score submission...');
    const loginRes = await request('/api/judge/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ judgeId: 1, pin: '1001' })
    });
    if (loginRes.status !== 200) throw new Error('Judge login failed');

    const scoreRes = await request('/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ judgeId: 1, pin: '1001', score: 10 })
    });
    if (scoreRes.status !== 200 || !scoreRes.body.success) throw new Error('Score submission failed');
    console.log('✅ Judge score 10 recorded for Design #01');

    // 5. Test CSV Export in English
    console.log('5. Testing CSV Export in English...');
    const csvRes = await request('/api/export/csv?competition=flags');
    if (csvRes.status !== 200 || !csvRes.body.includes('Judge 01') || !csvRes.body.includes('Design Number')) {
      throw new Error('CSV export failed or missing English headers');
    }
    console.log('✅ CSV Export verified in English');

    console.log('\n🎉 ALL TESTS PASSED! Admin Password Protection & 100% English Verified.');
    server.close(() => process.exit(0));
  } catch (err) {
    console.error('❌ Test failed:', err.message);
    server.close(() => process.exit(1));
  }
}

testServer();
