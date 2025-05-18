const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { deleteContextAuthData } = require('../controllers/auth.controller');
const SuspiciousLogin = require('../models/suspiciousLogin.model');

let mongoServer;

describe('deleteContextAuthData Controller', () => {
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

  test('nên xóa context data thành công', async () => {
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

    await deleteContextAuthData(req, res);

    // Kiểm tra response
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Data deleted successfully'
    });

    // Kiểm tra dữ liệu đã bị xóa
    const deletedData = await SuspiciousLogin.findById(mockContextId);
    expect(deletedData).toBeNull();
  });

  test('nên xử lý lỗi khi xóa context data thất bại', async () => {
    const req = {
      params: {
        contextId: 'invalid-id'
      }
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    await deleteContextAuthData(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Internal server error'
    });
  });
});