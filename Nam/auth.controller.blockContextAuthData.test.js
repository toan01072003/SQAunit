const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { blockContextAuthData } = require('../controllers/auth.controller');
const SuspiciousLogin = require('../models/suspiciousLogin.model');

let mongoServer;

describe('blockContextAuthData Controller', () => {
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
  const mockContextId = new mongoose.Types.ObjectId();

  const mockSuspiciousLogin = {
    _id: mockContextId,
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

  test('nên block context data thành công', async () => {
    // Tạo suspicious login test
    await SuspiciousLogin.create(mockSuspiciousLogin);

    const req = {
      params: {
        contextId: mockContextId.toString()
      }
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    await blockContextAuthData(req, res);

    // Kiểm tra response
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Blocked successfully'
    });

    // Kiểm tra dữ liệu đã được cập nhật
    const updatedData = await SuspiciousLogin.findById(mockContextId);
    expect(updatedData.isBlocked).toBe(true);
    expect(updatedData.isTrusted).toBe(false);
  });

  test('nên xử lý lỗi khi block context data thất bại', async () => {
    const req = {
      params: {
        contextId: 'invalid-id'
      }
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    await blockContextAuthData(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Internal server error'
    });
  });
});