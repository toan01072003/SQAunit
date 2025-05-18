const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const SuspiciousLogin = require('../models/suspiciousLogin.model');
const { getOldSuspiciousContextData } = require('../controllers/auth.controller');

let mongoServer;

describe('getOldSuspiciousContextData', () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    console.log("Connect to db");
    
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await SuspiciousLogin.deleteMany({});
  });

  it('should return null when no matching suspicious login data exists', async () => {
    const userId = new mongoose.Types.ObjectId();
    const currentContextData = {
      ip: '192.168.1.1',
      country: 'US',
      city: 'New York',
      browser: 'Chrome 98.0.4758.102',
      platform: 'Windows',
      os: 'Windows 10',
      device: 'Unknown',
      deviceType: 'Desktop'
    };

    const result = await getOldSuspiciousContextData(userId, currentContextData);
    expect(result).toBeNull();
  });

  it('should return matching suspicious login data when it exists', async () => {
    const userId = new mongoose.Types.ObjectId();
    const contextData = {
      user: userId,
      email: 'test@example.com',
      ip: '192.168.1.1',
      country: 'US', 
      city: 'New York',
      browser: 'Chrome 98.0.4758.102',
      platform: 'Windows',
      os: 'Windows 10',
      device: 'Unknown',
      deviceType: 'Desktop'
    };

    await SuspiciousLogin.create(contextData);

    const result = await getOldSuspiciousContextData(userId, contextData);

    expect(result).toBeTruthy();
    expect(result.user.toString()).toBe(userId.toString());
    expect(result.ip).toBe(contextData.ip);
    expect(result.country).toBe(contextData.country);
    expect(result.city).toBe(contextData.city);
    expect(result.browser).toBe(contextData.browser);
    expect(result.platform).toBe(contextData.platform);
    expect(result.os).toBe(contextData.os);
    expect(result.device).toBe(contextData.device);
    expect(result.deviceType).toBe(contextData.deviceType);
  });

  it('should return null when context data partially matches', async () => {
    const userId = new mongoose.Types.ObjectId();
    const storedContextData = {
      user: userId,
      email: 'test@example.com',
      ip: '192.168.1.1',
      country: 'US',
      city: 'New York',
      browser: 'Chrome 98.0.4758.102',
      platform: 'Windows',
      os: 'Windows 10',
      device: 'Unknown',
      deviceType: 'Desktop'
    };

    await SuspiciousLogin.create(storedContextData);

    const differentContextData = {
      ...storedContextData,
      ip: '192.168.1.2', // IP khác
      city: 'Los Angeles' // Thành phố khác
    };

    const result = await getOldSuspiciousContextData(userId, differentContextData);
    expect(result).toBeNull();
  });
});