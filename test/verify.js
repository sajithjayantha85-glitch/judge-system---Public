const http = require('http');
const { server } = require('../server');

async function testServer() {
  console.log('Testing synchronized judging server endpoints...');

  await new Promise((resolve) => server.listen(3002, resolve));

  function request(path, options = {}) {
    return new Promise((resolve, reject) => {
      const opt = {
        hostname: '127.0.0.1',
        port: 3002,
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
    console.log('✅ State verified (20 judges configured)');

    // 2. Judge Login
    console.log('2. Testing Judge Login (Judge 01, PIN 1001)...');
    const loginRes = await request('/api/judge/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ judgeId: 1, pin: '1001' })
    });
    if (loginRes.status !== 200 || !loginRes.body.success) throw new Error('Judge login failed');
    console.log('✅ Judge login passed');

    // 3. Admin opens voting for Item 1
    console.log('3. Admin opens voting for Item 1...');
    const roundRes = await request('/api/admin/set-round', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ competition: 'flags', itemNumber: 1, votingOpen: true })
    });
    if (roundRes.status !== 200 || !roundRes.body.votingOpen) throw new Error('Admin open voting failed');
    console.log('✅ Admin set-round passed (Voting opened)');

    // 4. Judge 01 submits score 9
    console.log('4. Judge 01 submits score 9...');
    const scoreRes = await request('/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        judgeId: 1,
        pin: '1001',
        score: 9
      })
    });
    if (scoreRes.status !== 200 || !scoreRes.body.success) throw new Error('Score submission failed');
    console.log('✅ Score submission passed (Score 9 recorded for Item 1)');

    // 5. Test CSV export
    console.log('5. Testing CSV Export...');
    const csvRes = await request('/api/export/csv?competition=flags');
    if (csvRes.status !== 200 || !csvRes.body.includes('Judge 01')) {
      throw new Error('CSV export failed');
    }
    console.log('✅ CSV Export passed');

    console.log('\n🎉 ALL SYNCHRONIZED TESTS PASSED SUCCESSFULLY!');
    server.close(() => process.exit(0));
  } catch (err) {
    console.error('❌ Test failed:', err.message);
    server.close(() => process.exit(1));
  }
}

testServer();
