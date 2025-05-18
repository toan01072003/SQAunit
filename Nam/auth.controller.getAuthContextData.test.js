const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { getAuthContextData } = require('../controllers/auth.controller');
const UserContext = require('../models/context.model');

let mongoServer;

describe('getAuthContextData Controller', () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await UserContext.deleteMany({});
  });

  const mockUserId = new mongoose.Types.ObjectId('6829b85917c739b2496c7cfe');

  const mockUserContext = {
    user: mockUserId,
    email: 'nam2307nguyen@gmail.com',
    ip: '192.168.1.1',
    country: 'Vietnam',
    city: 'Ho Chi Minh',
    browser: 'Chrome 120.0.0',
    platform: 'Windows',
    os: 'Windows 11',
    device: 'Unknown',
    deviceType: 'Desktop',
    isTrusted: true
  };

  test('nên trả về context data của user khi tìm thấy', async () => {
    // Tạo mock user context
    const createdContext = await UserContext.create(mockUserContext);

    const req = {
      userId: mockUserId.toString()
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    await getAuthContextData(req, res);

    // Kiểm tra response
    expect(res.status).toHaveBeenCalledWith(200);
    const responseData = res.json.mock.calls[0][0];
    expect(responseData).toMatchObject({
      ip: mockUserContext.ip,
      country: mockUserContext.country,
      city: mockUserContext.city,
      browser: mockUserContext.browser,
      platform: mockUserContext.platform,
      os: mockUserContext.os,
      device: mockUserContext.device,
      deviceType: mockUserContext.deviceType
    });
    expect(responseData).toHaveProperty('firstAdded');
  });

  test('nên trả về 404 khi không tìm thấy context data', async () => {
    const req = {
      userId: mockUserId.toString()
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    await getAuthContextData(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Not found'
    });
  });

  test('nên xử lý lỗi một cách phù hợp', async () => {
    const req = {
      userId: 'invalid-id'
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    await getAuthContextData(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Internal server error'
    });
  });
});