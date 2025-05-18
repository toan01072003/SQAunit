const { isOldDataMatched } = require('../controllers/auth.controller');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const SuspiciousLogin = require('../models/suspiciousLogin.model');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('isOldDataMatched function', () => {
  beforeEach(async () => {
    await SuspiciousLogin.deleteMany({});
  });

  test('nên trả về true khi tất cả các thuộc tính khớp nhau', async () => {
    const testData = {
      ip: '192.168.1.1',
      country: 'VN',
      city: 'Hanoi',
      browser: 'Chrome 96.0', 
      platform: 'Windows',
      os: 'Windows 10',
      device: 'Desktop',
      deviceType: 'Desktop'
    };

    const oldLogin = new SuspiciousLogin({
      user: new mongoose.Types.ObjectId(),
      email: 'test@example.com',
      ...testData
    });
    await oldLogin.save();

    // Extract only the matching fields for comparison
    const oldLoginData = {
      ip: oldLogin.ip,
      country: oldLogin.country,
      city: oldLogin.city,
      browser: oldLogin.browser,
      platform: oldLogin.platform,
      os: oldLogin.os,
      device: oldLogin.device,
      deviceType: oldLogin.deviceType
    };

    const result = isOldDataMatched(oldLoginData, testData);
    expect(result).toBe(true);
  });

  test('nên trả về false khi có ít nhất một thuộc tính không khớp', async () => {
    const oldData = {
      ip: '192.168.1.1',
      country: 'VN',
      city: 'Hanoi',
      browser: 'Chrome 96.0',
      platform: 'Windows', 
      os: 'Windows 10',
      device: 'Desktop',
      deviceType: 'Desktop'
    };

    const oldLogin = new SuspiciousLogin({
      user: new mongoose.Types.ObjectId(),
      email: 'test@example.com',
      ...oldData
    });
    await oldLogin.save();

    const oldLoginData = {
      ip: oldLogin.ip,
      country: oldLogin.country,
      city: oldLogin.city,
      browser: oldLogin.browser,
      platform: oldLogin.platform,
      os: oldLogin.os,
      device: oldLogin.device,
      deviceType: oldLogin.deviceType
    };

    const newData = {
      ...oldData,
      ip: '192.168.1.2' // IP khác
    };

    const result = isOldDataMatched(oldLoginData, newData);
    expect(result).toBe(false);
  });

  test('nên trả về false khi thiếu thuộc tính trong dữ liệu mới', async () => {
    const oldData = {
      ip: '192.168.1.1',
      country: 'VN',
      city: 'Hanoi',
      browser: 'Chrome 96.0',
      platform: 'Windows',
      os: 'Windows 10',
      device: 'Desktop',
      deviceType: 'Desktop'
    };

    const oldLogin = new SuspiciousLogin({
      user: new mongoose.Types.ObjectId(),
      email: 'test@example.com',
      ...oldData
    });
    await oldLogin.save();

    const oldLoginData = {
      ip: oldLogin.ip,
      country: oldLogin.country,
      city: oldLogin.city,
      browser: oldLogin.browser,
      platform: oldLogin.platform,
      os: oldLogin.os,
      device: oldLogin.device,
      deviceType: oldLogin.deviceType
    };

    const newData = {
      ip: '192.168.1.1',
      country: 'VN'
      // thiếu các thuộc tính khác
    };

    const result = isOldDataMatched(oldLoginData, newData);
    expect(result).toBe(false);
  });

  test('nên xử lý đúng khi có thuộc tính undefined hoặc null', async () => {
    const testData = {
      ip: '192.168.1.1',
      country: 'unknown',
      city: 'unknown',
      browser: 'Chrome 96.0',
      platform: 'Windows',
      os: 'Windows 10',
      device: 'Desktop',
      deviceType: 'Desktop'
    };

    const oldLogin = new SuspiciousLogin({
      user: new mongoose.Types.ObjectId(),
      email: 'test@example.com',
      ...testData
    });
    await oldLogin.save();

    const oldLoginData = {
      ip: oldLogin.ip,
      country: oldLogin.country,
      city: oldLogin.city,
      browser: oldLogin.browser,
      platform: oldLogin.platform,
      os: oldLogin.os,
      device: oldLogin.device,
      deviceType: oldLogin.deviceType
    };

    const result = isOldDataMatched(oldLoginData, testData);
    expect(result).toBe(true);
  });
});