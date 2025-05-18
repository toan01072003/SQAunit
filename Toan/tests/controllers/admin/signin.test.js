const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Admin = require('../../../models/admin.model');
const AdminToken = require('../../../models/token.admin.model');
const bcrypt = require('bcrypt');
// const jwt = require('jsonwebtoken'); // Not strictly needed for these tests unless verifying token structure

const { signin } = require('../../../controllers/admin.controller');

let mongoServer;
// let adminUser; // Not directly used in signin tests as we create admins per test

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
});

describe('Admin Signin Tests', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    mockReq = {
      body: {},
      // No admin context needed for signin itself
      headers: {} // No auth token needed for signin
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  describe('signin', () => {
    // Test ID: AUTH_001
    // Purpose: Verify successful admin login with valid credentials
    it('AUTH_001: should sign in admin with valid credentials and create token', async () => {
      const plainPassword = 'validPassword';
      const hashedPassword = await bcrypt.hash(plainPassword, 10);
      const admin = await Admin.create({ username: 'adminlogin', password: hashedPassword });
      
      mockReq.body = { username: 'adminlogin', password: plainPassword };

      await signin(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        accessToken: expect.any(String),
        user: expect.objectContaining({ _id: admin._id, username: 'adminlogin' }),
      }));

      // DB Check: Verify AdminToken was created
      const adminToken = await AdminToken.findOne({ user: admin._id });
      expect(adminToken).not.toBeNull();
      expect(adminToken.accessToken).toBe(mockRes.json.mock.calls[0][0].accessToken);
    });

    // Test ID: AUTH_002
    // Purpose: Verify system handles non-existent admin login attempts
    it('AUTH_002: should return 404 for non-existent admin', async () => {
      mockReq.body = { username: 'nonexistent', password: 'password' };
      await signin(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Invalid credentials' });
    });

    // Test ID: AUTH_003
    // Purpose: Verify system rejects login with incorrect password
    it('AUTH_003: should return 400 for invalid password', async () => {
      const plainPassword = 'correctPassword';
      const hashedPassword = await bcrypt.hash(plainPassword, 10);
      await Admin.create({ username: 'admincheck', password: hashedPassword });

      mockReq.body = { username: 'admincheck', password: 'wrongPassword' };
      await signin(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Invalid credentials' });
    });

    // Test ID: AUTH_004
    // Purpose: Verify system handles internal server errors during signin
    it('AUTH_004: should return 500 for server errors during signin', async () => {
        mockReq.body = { username: 'adminerror', password: 'password' };
        jest.spyOn(Admin, 'findOne').mockRejectedValueOnce(new Error('Database connection failed'));

        await signin(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({ message: 'Something went wrong' });
        jest.restoreAllMocks();
    });
  });
});