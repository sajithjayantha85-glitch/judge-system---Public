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
    if (stateRes.body.totalItems.flags !== 15 || stateRes.body.totalItems.emblems !== 15 || stateRes.body.totalItems.stamps !== 15) {
      throw new Error('Expected 15 flags, 15 emblems, and 15 stamps');
    }
    console.log('✅ State verified (20 judges configured, 15 Flags, 15 Emblems & 15 Stamps)');

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

    // 3. Test Admin set-round for Flags
    console.log('3. Opening voting for Flags Design #01...');
    const roundRes = await request('/api/admin/set-round', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-password': 'admin2026'
      },
      body: JSON.stringify({ competition: 'flags', itemNumber: 1, votingOpen: true })
    });
    if (roundRes.status !== 200 || !roundRes.body.votingOpen) throw new Error('Admin open voting failed');
    console.log('✅ Admin set-round succeeded (Voting opened for Flag Design #01)');

    // 4. Judge Login & Submit Score for Flags
    console.log('4. Testing Judge 01 Login & Score submission for Flag Design #01...');
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
    console.log('✅ Judge score 10 recorded for Flag Design #01');

    // 5. Test Admin set-round for Commemorative Stamps
    console.log('5. Testing Admin switch to Commemorative Stamps...');
    const stampRoundRes = await request('/api/admin/set-round', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-password': 'admin2026'
      },
      body: JSON.stringify({ competition: 'stamps', itemNumber: 1, votingOpen: true })
    });
    if (stampRoundRes.status !== 200 || stampRoundRes.body.activeCompetition !== 'stamps') {
      throw new Error('Switching to stamps competition failed');
    }
    console.log('✅ Admin switched to Commemorative Stamps successfully');

    // 6. Judge Submit Score for Stamps
    console.log('6. Submitting Judge 02 score for Stamp Design #01...');
    const stampScoreRes = await request('/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ judgeId: 2, pin: '1002', score: 9 })
    });
    if (stampScoreRes.status !== 200 || !stampScoreRes.body.success) throw new Error('Stamp score submission failed');
    console.log('✅ Judge 02 score 9 recorded for Stamp Design #01');

    // 7. Test CSV Export for Stamps
    console.log('7. Testing CSV Export for Commemorative Stamps...');
    const csvRes = await request('/api/export/csv?competition=stamps');
    if (csvRes.status !== 200 || !csvRes.body.includes('Judge 01') || !csvRes.body.includes('Stamp #01')) {
      throw new Error('Stamps CSV export failed or missing Stamp labels');
    }
    console.log('✅ Stamps CSV Export verified (with Stamp #01 label)');

    // 8. Test Artwork Image Upload & Removal
    console.log('8. Testing Artwork Image Upload for Flag Design #01...');
    const boundary = '--------------------------' + Date.now().toString(16);
    const pngData = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082', 'hex');
    
    let multipartParts = '';
    multipartParts += `--${boundary}\r\nContent-Disposition: form-data; name="competition"\r\n\r\nflags\r\n`;
    multipartParts += `--${boundary}\r\nContent-Disposition: form-data; name="itemNumber"\r\n\r\n1\r\n`;
    multipartParts += `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="test_flag.png"\r\nContent-Type: image/png\r\n\r\n`;
    
    const multipartBody = Buffer.concat([
      Buffer.from(multipartParts, 'utf-8'),
      pngData,
      Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8')
    ]);

    const uploadRes = await request('/api/admin/upload-image', {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': multipartBody.length,
        'x-admin-password': 'admin2026'
      },
      body: multipartBody
    });

    if (uploadRes.status !== 200 || !uploadRes.body.success || !uploadRes.body.imageUrl) {
      throw new Error(`Upload image failed: ${JSON.stringify(uploadRes.body)}`);
    }
    const uploadedUrl = uploadRes.body.imageUrl;
    console.log(`✅ Artwork image uploaded successfully (${uploadedUrl})`);

    // Verify static asset serving
    const staticRes = await request(uploadedUrl);
    if (staticRes.status !== 200) throw new Error(`Failed to fetch uploaded static file at ${uploadedUrl}`);
    console.log('✅ Uploaded image verified via static file serving');

    // Test Image Removal
    console.log('8.1 Testing Artwork Image Removal...');
    const removeRes = await request('/api/admin/remove-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-password': 'admin2026'
      },
      body: JSON.stringify({ competition: 'flags', itemNumber: 1 })
    });
    if (removeRes.status !== 200 || !removeRes.body.success) {
      throw new Error(`Remove image failed: ${JSON.stringify(removeRes.body)}`);
    }

    // Verify state removed image
    const finalStateRes = await request('/api/state');
    if (finalStateRes.body.images && finalStateRes.body.images.flags && finalStateRes.body.images.flags['1']) {
      throw new Error('Image still exists in state after removal');
    }
    console.log('✅ Artwork image removed and state updated properly');

    console.log('\n🎉 ALL TESTS PASSED! Flags (15), Emblems (15), Stamps (15), and Artwork Image Uploading fully operational!');
    server.close(() => process.exit(0));
  } catch (err) {
    console.error('❌ Test failed:', err.message);
    server.close(() => process.exit(1));
  }
}

testServer();
