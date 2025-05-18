require('dotenv').config();
const mongoose = require('mongoose');
const UserContext = require('../models/context.model');
const User = require('../models/user.model');

describe('Database Authentication Tests', () => {
  beforeAll(async () => {
    try {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log('Đã kết nối với database test');
    } catch (error) {
      console.error('Lỗi kết nối database:', error);
      throw error;
    }
  });

  afterAll(async () => {
    await mongoose.disconnect();
    console.log('Đã ngắt kết nối database');
  });

  beforeEach(async () => {
    // Xóa dữ liệu test trước mỗi test case
    await UserContext.deleteMany({});
    await User.deleteMany({});
  });

  test('Nên tạo được user mới trong database', async () => {
    const testUser = new User({
      name: 'Test User',
      email: 'test@example.com',
      password: '123456',
      followers: [],
      following: [],
      location: '',
      bio: '',
      interests: '',
      role: 'general',
      savedPosts: [],
      isEmailVerified: false
    });

    const savedUser = await testUser.save();
    expect(savedUser._id).toBeDefined();
    expect(savedUser.email).toBe('test@example.com');
  });

  test('Nên tạo được context mới cho user', async () => {
    // Tạo user trước
    const testUser = await User.create({
      name: 'Test User',
      email: 'test@example.com',
      password: '123456',
      followers: [],
      following: [],
      location: '',
      bio: '',
      interests: '',
      role: 'general',
      savedPosts: [],
      isEmailVerified: false
    });

    // Tạo context cho user
    const testContext = new UserContext({
      user: testUser._id,
      email: testUser.email,
      ip: '192.168.1.1',
      country: 'Vietnam',
      city: 'Ho Chi Minh',
      browser: 'Chrome',
      platform: 'Win32',
      os: 'Windows',
      device: 'Unknown',
      deviceType: 'Desktop',
      isTrusted: true
    });

    const savedContext = await testContext.save();
    expect(savedContext._id).toBeDefined();
    expect(savedContext.user.toString()).toBe(testUser._id.toString());
  });

  test('Nên tìm được context của user', async () => {
    // Tạo user và context
    const testUser = await User.create({
      name: 'Test User',
      email: 'test@example.com',
      password: '123456',
      followers: [],
      following: [],
      location: '',
      bio: '',
      interests: '',
      role: 'general',
      savedPosts: [],
      isEmailVerified: false
    });

    await UserContext.create({
      user: testUser._id,
      email: testUser.email,
      ip: '192.168.1.1',
      country: 'Vietnam',
      city: 'Ho Chi Minh',
      browser: 'Chrome',
      platform: 'Win32',
      os: 'Windows',
      device: 'Unknown',
      deviceType: 'Desktop',
      isTrusted: true
    });

    const foundContext = await UserContext.findOne({ user: testUser._id });
    expect(foundContext).toBeDefined();
    expect(foundContext.email).toBe(testUser.email);
  });
});