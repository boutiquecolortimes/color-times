import { logRequest, netlog, redact } from '../src/lib/netlog';

describe('API log', () => {
  beforeEach(() => {
    netlog.clear();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('masks passwords and tokens anywhere in a payload', () => {
    expect(
      redact({
        email: 'a@b.co',
        password: 'hunter2',
        data: { user: { name: 'A' }, accessToken: 'x', refreshToken: 'y' },
        otp: '1234',
      })
    ).toEqual({
      email: 'a@b.co',
      password: '•••',
      data: { user: { name: 'A' }, accessToken: '•••', refreshToken: '•••' },
      otp: '•••',
    });
  });

  it('records method, path, query, body, status and response; newest first', () => {
    logRequest('GET', '/api/bookings?status=active&page=2').done(200, { success: true, data: [] });
    logRequest('POST', '/api/auth/login', { email: 'a@b.co', password: 'p' }).done(401, {
      success: false,
      error: 'Invalid credentials',
    });
    const [login, list] = netlog.entries();
    expect(login).toMatchObject({
      method: 'POST',
      path: '/api/auth/login',
      body: { email: 'a@b.co', password: '•••' },
      status: 401,
      response: { success: false, error: 'Invalid credentials' },
    });
    expect(list).toMatchObject({ path: '/api/bookings', query: { status: 'active', page: '2' }, status: 200 });
    expect(console.warn).toHaveBeenCalled(); // 4xx are warnings
  });

  it('records network failures', () => {
    logRequest('GET', '/api/mobile/me').fail("Can't reach Color Times.");
    expect(netlog.entries()[0].error).toBe("Can't reach Color Times.");
  });
});
