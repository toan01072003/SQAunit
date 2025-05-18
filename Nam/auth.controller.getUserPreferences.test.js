const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { getUserPreferences } = require('../controllers/auth.controller');
const UserPreference = require('../models/preference.model');

let mongoServer;

describe('getUserPreferences Controller', () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await UserPreference.deleteMany({});
  });

  const mockUserId = new mongoose.Types.ObjectId('6829b85917c739b2496c7cfe');

  const mockPreferences = {
    user: mockUserId,
    enableContextBasedAuth: false
  };

  test('nên trả về user preferences khi tìm thấy', async () => {
    // Tạo preferences test
    const createdPrefs = await UserPreference.create(mockPreferences);

    const req = {
      userId: mockUserId.toString()
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    await getUserPreferences(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const responseData = res.json.mock.calls[0][0];
    expect(responseData.user.toString()).toBe(mockUserId.toString());
    expect(responseData.enableContextBasedAuth).toBe(false);
  });

  test('nên trả về 404 khi không tìm thấy preferences', async () => {
    const req = {
      userId: mockUserId.toString()
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    await getUserPreferences(req, res);

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

    await getUserPreferences(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Internal server error'
    });
  });
});