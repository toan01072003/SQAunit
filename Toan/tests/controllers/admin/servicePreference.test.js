const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Config = require('../../../models/config.model');
const Admin = require('../../../models/admin.model');
const bcrypt = require('bcrypt');

const { retrieveServicePreference, updateServicePreference } = require('../../../controllers/admin.controller');

let mongoServer;
let adminUser;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

  const hashedPassword = await bcrypt.hash('adminpassword', 10);
  adminUser = new Admin({ username: 'testadminpref', password: hashedPassword });
  await adminUser.save();
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
  const existingAdmin = await Admin.findOne({ username: 'testadminpref' });
  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash('adminpassword', 10);
    adminUser = new Admin({ _id: adminUser._id, username: 'testadminpref', password: hashedPassword });
    await adminUser.save();
  }
});

describe('Admin Service Preference Tests', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    mockReq = {
      body: {},
      query: {},
      params: {},
      admin: { id: adminUser._id.toString(), username: adminUser.username },
      headers: {
        authorization: 'Bearer mockAdminToken'
      }
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  describe('retrieveServicePreference', () => {
    // Test ID: PREF_RETRIEVE_001
    it('PREF_RETRIEVE_001: should retrieve existing preferences', async () => {
      const existingConfig = await Config.create({ usePerspectiveAPI: true });
      await retrieveServicePreference(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        _id: existingConfig._id,
        usePerspectiveAPI: true,
      }));
    });

    // Test ID: PREF_RETRIEVE_002
    it('PREF_RETRIEVE_002: should create and retrieve default preferences if none exist', async () => {
      await retrieveServicePreference(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        usePerspectiveAPI: false, 
        categoryFilteringServiceProvider: "Google Perspective API",
        categoryFilteringRequestTimeout: 3000,
      }));
      const configInDb = await Config.findOne({});
      expect(configInDb).not.toBeNull();
      expect(configInDb.usePerspectiveAPI).toBe(false);
    });
    
    // Test ID: PREF_RETRIEVE_003
    it('PREF_RETRIEVE_003: should handle database errors during retrieval', async () => {
        jest.spyOn(Config, 'findOne').mockRejectedValueOnce(new Error('Database error'));
        await retrieveServicePreference(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({ message: 'Error retrieving system preferences' });
        jest.restoreAllMocks();
    });
  });

  describe('updateServicePreference', () => {
    // Test ID: PREF_UPDATE_001
    it('PREF_UPDATE_001: should update existing preferences successfully', async () => {
      await Config.create({ usePerspectiveAPI: false, categoryFilteringServiceProvider: "Old Provider" });
      mockReq.body = { usePerspectiveAPI: true, categoryFilteringServiceProvider: "New Provider", categoryFilteringRequestTimeout: 5000 };

      await updateServicePreference(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        usePerspectiveAPI: true,
        categoryFilteringServiceProvider: "New Provider",
        categoryFilteringRequestTimeout: 5000,
      }));
      const updatedConfig = await Config.findOne({});
      expect(updatedConfig.usePerspectiveAPI).toBe(true);
      expect(updatedConfig.categoryFilteringServiceProvider).toBe("New Provider");
    });

    // Test ID: PREF_UPDATE_002
    it('PREF_UPDATE_002: should create preferences if none exist (upsert)', async () => {
      mockReq.body = { usePerspectiveAPI: true, categoryFilteringRequestTimeout: 2000 };

      await updateServicePreference(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        usePerspectiveAPI: true,
        categoryFilteringRequestTimeout: 2000,
      }));
      const newConfig = await Config.findOne({});
      expect(newConfig.usePerspectiveAPI).toBe(true);
      expect(newConfig.categoryFilteringRequestTimeout).toBe(2000);
    });

    // Test ID: PREF_UPDATE_003
    it('PREF_UPDATE_003: should handle database errors during update', async () => {
      mockReq.body = { usePerspectiveAPI: true };
      jest.spyOn(Config, 'findOneAndUpdate').mockRejectedValueOnce(new Error('DB update failed'));
      await updateServicePreference(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Error updating system preferences' });
      jest.restoreAllMocks();
    });
  });
});