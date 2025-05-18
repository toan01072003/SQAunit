require('dotenv').config();
const mongoose = require('mongoose');
const { isTrustedDevice } = require('../controllers/auth.controller');
const UserContext = require('../models/context.model');
const User = require('../models/user.model');
const request = require('supertest');
const express = require('express');
const app = express();

describe('Context-based Authentication Tests', () => {
  let mockUser;
  let mockContextData;
  let server;

  beforeAll(async () => {
    try {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log('Connected to database: test');
      
      // Create a new Express app instance for testing
      const testApp = express();
      testApp.use(express.json());
      
      // Mock the login route instead of importing auth.routes
      testApp.post('/api/auth/login', async (req, res) => {
        const { email, password, contextData } = req.body;
        
        try {
          const user = await User.findOne({ email });
          if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
          }

          if (password !== user.password) {
            return res.status(401).json({ message: 'Invalid credentials' });
          }

          // Get user's trusted contexts
          const trustedContexts = await UserContext.find({ user: user._id, isTrusted: true });
          
          // Check if current context matches any trusted context
          const isSuspicious = !trustedContexts.some(context => 
            isTrustedDevice(contextData, {
              ip: context.ip,
              country: context.country,
              city: context.city,
              browser: context.browser,
              platform: context.platform,
              os: context.os,
              device: context.device,
              deviceType: context.deviceType
            })
          );

          if (isSuspicious) {
            return res.status(401).json({ message: 'Suspicious login attempt detected' });
          }

          // Mock token generation
          const accessToken = 'mock_access_token';
          res.status(200).json({ accessToken });
        } catch (error) {
          res.status(500).json({ message: 'Server error' });
        }
      });
      
      server = testApp.listen(0); // Use random port for testing
    } catch (error) {
      console.error('Database connection error:', error);
      throw error;
    }
  });

  afterAll(async () => {
    if (server) {
      await server.close();
    }
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await UserContext.deleteMany({});
    await User.deleteMany({});

    mockUser = await User.create({
      name: 'nam',
      email: 'nam2307nguyen@gmail.com',
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

    mockContextData = {
      user: mockUser._id,
      email: mockUser.email,
      ip: '192.168.1.1',
      country: 'Vietnam',
      city: 'Ho Chi Minh',
      browser: 'Chrome',
      platform: 'Win32',
      os: 'Windows',
      device: 'Unknown',
      deviceType: 'Desktop',
      isTrusted: true
    };
  });

  test('Nên phát hiện context đáng ngờ khi thông tin thiết bị thay đổi', async () => {
    await UserContext.create(mockContextData);

    const newContextData = {
      ...mockContextData,
      ip: '10.0.0.1',
      browser: 'Firefox 100',
      platform: 'MacIntel',
      os: 'MacOS'
    };

    const response = await request(server)
      .post('/api/auth/login')
      .send({
        email: mockUser.email,
        password: '123456',
        contextData: newContextData
      });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('message');
  });

  test('Nên tin tưởng context khi thông tin thiết bị khớp với dữ liệu đã lưu', async () => {
    await UserContext.create(mockContextData);

    const response = await request(server)
      .post('/api/auth/login')
      .send({
        email: mockUser.email,
        password: '123456',
        contextData: mockContextData
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('accessToken');
  });
});