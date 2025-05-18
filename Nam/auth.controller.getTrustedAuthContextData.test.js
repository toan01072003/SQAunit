const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { getTrustedAuthContextData } = require('../controllers/auth.controller');
const SuspiciousLogin = require('../models/suspiciousLogin.model');

let mongoServer;

describe('getTrustedAuthContextData Controller', () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await SuspiciousLogin.deleteMany({});
  });

  const mockUserId = new mongoose.Types.ObjectId();

  const mockTrustedLogin = {
    user: mockUserId,
    email: 'test@example.com',
    ip: '192.168.1.1',
    country: 'VN',
    city: 'Ho Chi Minh',
    browser: 'Chrome 120.0.0',
    platform: 'Windows',
    os: 'Windows 11',
    device: 'Unknown',
    deviceType: 'Desktop',
    isBlocked: false,
    isTrusted: true
  };

  test('nên trả về danh sách các thiết bị tin cậy', async () => {
    // Tạo mock trusted login data
    await SuspiciousLogin.create(mockTrustedLogin);

    const req = {
      userId: mockUserId.toString()
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    await getTrustedAuthContextData(req, res);

    // Kiểm tra response
    expect(res.status).toHaveBeenCalledWith(200);
    const responseData = res.json.mock.calls[0][0];
    expect(responseData).toHaveLength(1);
    expect(responseData[0]).toMatchObject({
      ip: mockTrustedLogin.ip,
      country: mockTrustedLogin.country,
      city: mockTrustedLogin.city,
      browser: mockTrustedLogin.browser,
      platform: mockTrustedLogin.platform,
      os: mockTrustedLogin.os,
      device: mockTrustedLogin.device,
      deviceType: mockTrustedLogin.deviceType
    });
    expect(responseData[0]).toHaveProperty('_id');
    expect(responseData[0]).toHaveProperty('time');
  });

  test('nên trả về mảng rỗng khi không có thiết bị tin cậy', async () => {
    const req = {
      userId: mockUserId.toString()
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    await getTrustedAuthContextData(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([]);
  });

  test('nên xử lý lỗi một cách phù hợp', async () => {
    const req = {
      userId: 'invalid-id'
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    await getTrustedAuthContextData(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Internal server error'
    });
  });
});