import http from 'node:http';

function request(options: http.RequestOptions, data?: any): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode || 500, data: JSON.parse(body || '{}') });
        } catch {
          resolve({ status: res.statusCode || 500, data: body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function testAuth() {
  console.log('--- 1. Testing Validation Failure on Register ---');
  const badReg = await request(
    {
      host: 'localhost',
      port: 4000,
      path: '/api/v1/auth/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    { email: 'bad-email', password: '123', fullName: '' }
  );
  console.log('Bad Register Status (Expected 400):', badReg.status, JSON.stringify(badReg.data));

  console.log('\n--- 2. Testing Seed User Login ---');
  const login = await request(
    {
      host: 'localhost',
      port: 4000,
      path: '/api/v1/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    { email: 'sumer.kumar@trademitra.local', password: 'Password@123' }
  );
  console.log('Login Status (Expected 200):', login.status);
  const token = login.data.data?.token;
  console.log('Token Received:', !!token);

  console.log('\n--- 3. Testing Protected GET /auth/me with Token ---');
  const me = await request({
    host: 'localhost',
    port: 4000,
    path: '/api/v1/auth/me',
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log(
    'Me Status (Expected 200):',
    me.status,
    me.data.data?.user?.email,
    'Wallet Cash Balance:',
    me.data.data?.wallet?.cashBalance
  );

  console.log('\n--- 4. Testing Protected GET /wallet without Token ---');
  const noToken = await request({
    host: 'localhost',
    port: 4000,
    path: '/api/v1/wallet',
    method: 'GET',
  });
  console.log('No Token Status (Expected 401):', noToken.status, JSON.stringify(noToken.data));

  console.log('\n--- 5. Testing Protected GET /wallet WITH Token ---');
  const withToken = await request({
    host: 'localhost',
    port: 4000,
    path: '/api/v1/wallet',
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log('Wallet Status with Token (Expected 200):', withToken.status, JSON.stringify(withToken.data));

  console.log('\n--- 6. Testing Order Placement Validation ---');
  const badOrder = await request(
    {
      host: 'localhost',
      port: 4000,
      path: '/api/v1/orders',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    },
    { contractId: '1', orderType: 'LIMIT', transactionType: 'BUY', productType: 'NRML', quantity: -5 }
  );
  console.log('Bad Order Status (Expected 400):', badOrder.status, JSON.stringify(badOrder.data));

  console.log('\n--- 7. Testing New User Registration Flow ---');
  const uniqueEmail = `trader_${Date.now()}@trademitra.local`;
  const newReg = await request(
    {
      host: 'localhost',
      port: 4000,
      path: '/api/v1/auth/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    {
      email: uniqueEmail,
      password: 'StrongPassword123!',
      fullName: 'Alpha Trader',
      phone: '+919988776655',
    }
  );
  console.log('New User Registered Status (Expected 201):', newReg.status, 'Wallet provisioned for:', newReg.data.data?.user?.email);
}

testAuth().catch(console.error);
