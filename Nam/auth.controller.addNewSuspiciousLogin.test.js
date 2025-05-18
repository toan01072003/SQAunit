const mongoose = require('mongoose');
const SuspiciousLogin = require('../models/suspiciousLogin.model');
const authController = require('../controllers/auth.controller');
require('dotenv').config();

describe('addNewSuspiciousLogin', () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Không xóa dữ liệu cũ để có thể quan sát trong database thật
  });

  it('should create a new suspicious login record', async () => {
    const existingUser = {
      _id: "682937fc990003172e90ab29",
      email: "test@example.com"
    };
    
    const currentContextData = {
      ip: '192.168.1.1',
      country: 'VN',
      city: 'Ho Chi Minh',
      browser: 'Chrome 120.0.0',
      platform: 'Windows',
      os: 'Windows 11',
      device: 'Unknown',
      deviceType: 'Desktop'
    };

    const result = await authController.addNewSuspiciousLogin(existingUser._id, existingUser, currentContextData);

    // Kiểm tra kết quả
    expect(result).toBeDefined();
    expect(result.user.toString()).toBe(existingUser._id);
    expect(result.email).toBe(existingUser.email);
    expect(result.ip).toBe(currentContextData.ip);
    expect(result.country).toBe(currentContextData.country);
    expect(result.city).toBe(currentContextData.city);
    expect(result.browser).toBe(currentContextData.browser);
    expect(result.platform).toBe(currentContextData.platform);
    expect(result.os).toBe(currentContextData.os);
    expect(result.device).toBe(currentContextData.device);
    expect(result.deviceType).toBe(currentContextData.deviceType);
    expect(result.unverifiedAttempts).toBe(0);
    expect(result.isTrusted).toBe(false);
    expect(result.isBlocked).toBe(false);

    // Log ra ID để dễ tìm trong database
    console.log('Created suspicious login record ID:', result._id);
    console.log('User ID:', existingUser._id);
  });

  it('should throw error when required fields are missing', async () => {
    const userId = new mongoose.Types.ObjectId();
    const existingUser = {
      _id: userId,
      // email bị thiếu
    };
    
    const currentContextData = {
      // thiếu các trường bắt buộc
    };

    await expect(authController.addNewSuspiciousLogin(userId, existingUser, currentContextData))
      .rejects
      .toThrow();
  });
});