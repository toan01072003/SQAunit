const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Log = require('../../../models/log.model');
const Admin = require('../../../models/admin.model'); // For admin context
const bcrypt = require('bcrypt');

const { retrieveLogInfo, deleteLogInfo } = require('../../../controllers/admin.controller');

let mongoServer;
let adminUser;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

  const hashedPassword = await bcrypt.hash('adminpassword', 10);
  adminUser = new Admin({ username: 'testadminlog', password: hashedPassword });
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
  // Re-create adminUser if it was deleted or modified in a test
  const existingAdmin = await Admin.findOne({ username: 'testadminlog' });
  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash('adminpassword', 10);
    adminUser = new Admin({ _id: adminUser._id, username: 'testadminlog', password: hashedPassword });
    await adminUser.save();
  }
});

describe('Admin LogInfo Tests', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    mockReq = {
      body: {},
      query: {},
      params: {},
      admin: { id: adminUser._id.toString(), username: adminUser.username }, // Assuming middleware attaches admin
      headers: {
        authorization: 'Bearer mockAdminToken'
      }
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      send: jest.fn(),
    };
  });

  describe('retrieveLogInfo', () => {
    // Test ID: LOG_001
    // Purpose: Verify successful retrieval and formatting of system logs
    it('LOG_001: should retrieve and format logs successfully', async () => {
      const date1 = new Date(Date.now() - 10000); // Older
      const date2 = new Date(); // Newer

      await Log.insertMany([
        { type: 'sign in', email: 'test1@example.com', context: 'IP:127.0.0.1,Browser:Chrome', message: 'User signed in', level: 'info', timestamp: date1 },
        { type: 'general', message: 'General action', level: 'info', timestamp: date2 },
      ]);

      await retrieveLogInfo(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      const responseLogs = mockRes.json.mock.calls[0][0];
      expect(responseLogs.length).toBe(2);
      expect(responseLogs[0].message).toBe('General action'); // Sorted by timestamp desc
      expect(responseLogs[1].message).toBe('User signed in');
      expect(responseLogs[0].contextData).toBeUndefined(); // General log
      expect(responseLogs[1].contextData).toEqual({ 'IP Address': '127.0.0.1', 'Browser': 'Chrome' });
    });
    
    // Test ID: LOG_002
    // Purpose: Verify system handles database errors during log retrieval
    it('LOG_002: should handle errors when retrieving logs', async () => {
      jest.spyOn(Log, 'find').mockImplementation(() => ({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockRejectedValue(new Error('Database error'))
      }));
      
      await retrieveLogInfo(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Internal server error' }); 
      jest.restoreAllMocks();
    });

    // Test ID: LOG_003
    // Purpose: Verify system handles empty log results appropriately
    it('LOG_003: should handle empty log results', async () => {
      await retrieveLogInfo(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith([]);
    });
  });

  describe('deleteLogInfo', () => {
    // Test ID: DELETE_LOG_001
// Test ID: DELETE_LOG_VERIFY_001
it('DELETE_LOG_001: should verify logs exist before deletion and are gone after', async () => {
  // Step 1: Seed dữ liệu log
  await Log.create([
    { message: 'Log before delete', type: 'info', level: 'info', timestamp: new Date() }
  ]);

  // Step 2: Check logs exist
  let logsBefore = await Log.find();
  console.log('🟡 Logs before deletion:', logsBefore); // 👈 SHOW in terminal
  expect(logsBefore.length).toBe(1);

  // Step 3: Call controller
  await deleteLogInfo(mockReq, mockRes);

  // Step 4: Check logs are gone
  expect(mockRes.status).toHaveBeenCalledWith(200);
  expect(mockRes.json).toHaveBeenCalledWith({ message: 'All logs deleted!' });

  const logsAfter = await Log.find();
  console.log('🟢 Logs after deletion:', logsAfter); // 👈 SHOW in terminal
  expect(logsAfter.length).toBe(0); // ✅
});



    // Test ID: DELETE_LOG_002
    it('DELETE_LOG_002: should handle errors during log deletion', async () => {
      jest.spyOn(Log, 'deleteMany').mockRejectedValueOnce(new Error('DB deletion failed'));
      await deleteLogInfo(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Something went wrong!' });
      jest.restoreAllMocks();
    });
  });
});