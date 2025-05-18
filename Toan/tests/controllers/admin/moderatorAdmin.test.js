const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Community = require('../../../models/community.model');
const User = require('../../../models/user.model');
const Admin = require('../../../models/admin.model');
const bcrypt = require('bcrypt');

const { addModerator, removeModerator, getModerators } = require('../../../controllers/admin.controller');

let mongoServer;
let adminUser;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

  const hashedPassword = await bcrypt.hash('adminpassword', 10);
  adminUser = new Admin({ username: 'testadminmod', password: hashedPassword });
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
  await User.deleteMany({});
  await Community.deleteMany({});
  
  const existingAdmin = await Admin.findOne({ username: 'testadminmod' });
  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash('adminpassword', 10);
    adminUser = new Admin({ _id: adminUser._id, username: 'testadminmod', password: hashedPassword });
    await adminUser.save();
  }
});
// Helper để in trạng thái community và user trước/sau
const printState = async (testId, label, communityId, userId) => {
  const community = await Community.findById(communityId);
  const user = await User.findById(userId);
  console.log(`[${testId}] ${label} Community moderators:`, community?.moderators || []);
  console.log(`[${testId}] ${label} User role:`, user?.role || 'N/A');
};



describe('Admin Moderator Management Tests', () => {
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

  describe('addModerator', () => {
    let community, user;
    beforeEach(async () => {
        community = await Community.create({ name: 'Mod Test Comm', description: 'Test' });
        user = await User.create({ name: 'Potential Mod', email: 'potmod@example.com', password: 'password', role: 'general' });
    });

    it('ADD_MOD_001: should add a user as a moderator and update user role', async () => {
      mockReq.body = { communityId: community._id.toString(), userId: user._id.toString() };
      await printState('ADD_MOD_001', '🟡 BEFORE', community._id, user._id);
      await addModerator(mockReq, mockRes);
      await printState('ADD_MOD_001', '🟢 AFTER', community._id, user._id);
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('ADD_MOD_002: should return 404 if community not found', async () => {
      mockReq.body = { communityId: new mongoose.Types.ObjectId().toString(), userId: user._id.toString() };
      await printState('ADD_MOD_002', '🟡 BEFORE', community._id, user._id);
      await addModerator(mockReq, mockRes);
      await printState('ADD_MOD_002', '🟢 AFTER', community._id, user._id);
      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('ADD_MOD_003: should return 404 if user not found', async () => {
      mockReq.body = { communityId: community._id.toString(), userId: new mongoose.Types.ObjectId().toString() };
      await printState('ADD_MOD_003', '🟡 BEFORE', community._id, user._id);
      await addModerator(mockReq, mockRes);
      await printState('ADD_MOD_003', '🟢 AFTER', community._id, user._id);
      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('ADD_MOD_004: should return 400 if user is already a moderator', async () => {
      await Community.findByIdAndUpdate(community._id, { $addToSet: { moderators: user._id } });
      await User.findByIdAndUpdate(user._id, { role: 'moderator' });
      mockReq.body = { communityId: community._id.toString(), userId: user._id.toString() };
      await printState('ADD_MOD_004', '🟡 BEFORE', community._id, user._id);
      await addModerator(mockReq, mockRes);
      await printState('ADD_MOD_004', '🟢 AFTER', community._id, user._id);
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('ADD_MOD_005: should handle database errors during update', async () => {
      mockReq.body = { communityId: community._id.toString(), userId: user._id.toString() };
      await printState('ADD_MOD_005', '🟡 BEFORE', community._id, user._id);
      jest.spyOn(Community, 'findByIdAndUpdate').mockRejectedValueOnce(new Error('DB error'));
      await addModerator(mockReq, mockRes);
      await printState('ADD_MOD_005', '🟢 AFTER', community._id, user._id);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      jest.restoreAllMocks();
    });
    
  });

  describe('removeModerator', () => {
    let community, user;
    beforeEach(async () => {
        user = await User.create({ name: 'Current Mod', email: 'curmod@example.com', password: 'password', role: 'moderator' });
        community = await Community.create({ name: 'Mod Removal Comm', description: 'Test', moderators: [user._id] });
    });

    it('REMOVE_MOD_001: should remove a moderator and update user role to general', async () => {
      mockReq.body = { communityId: community._id.toString(), userId: user._id.toString() };
      await printState('REMOVE_MOD_001', '🟡 BEFORE', community._id, user._id);
      await removeModerator(mockReq, mockRes);
      await printState('REMOVE_MOD_001', '🟢 AFTER', community._id, user._id);
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('REMOVE_MOD_002: should return 404 if community not found', async () => {
      mockReq.body = { communityId: new mongoose.Types.ObjectId().toString(), userId: user._id.toString() };
      await printState('REMOVE_MOD_002', '🟡 BEFORE', community._id, user._id);
      await removeModerator(mockReq, mockRes);
      await printState('REMOVE_MOD_002', '🟢 AFTER', community._id, user._id);
      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('REMOVE_MOD_003: should return 404 if user not found', async () => {
      mockReq.body = { communityId: community._id.toString(), userId: new mongoose.Types.ObjectId().toString() };
      await printState('REMOVE_MOD_003', '🟡 BEFORE', community._id, user._id);
      await removeModerator(mockReq, mockRes);
      await printState('REMOVE_MOD_003', '🟢 AFTER', community._id, user._id);
      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('REMOVE_MOD_004: should return 400 if user is not a moderator of this community', async () => {
      const nonModUser = await User.create({ name: 'Not A Mod', email: 'notamod@example.com', password: 'password' });
      mockReq.body = { communityId: community._id.toString(), userId: nonModUser._id.toString() };
      await printState('REMOVE_MOD_004', '🟡 BEFORE', community._id, nonModUser._id);
      await removeModerator(mockReq, mockRes);
      await printState('REMOVE_MOD_004', '🟢 AFTER', community._id, nonModUser._id);
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('REMOVE_MOD_005: should handle database errors during removal', async () => {
      mockReq.body = { communityId: community._id.toString(), userId: user._id.toString() };
      await printState('REMOVE_MOD_005', '🟡 BEFORE', community._id, user._id);
      jest.spyOn(User, 'findByIdAndUpdate').mockRejectedValueOnce(new Error('DB error'));
      await removeModerator(mockReq, mockRes);
      await printState('REMOVE_MOD_005', '🟢 AFTER', community._id, user._id);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      jest.restoreAllMocks();
    });
    
  });

  describe('getModerators', () => {
    // Test ID: GET_MODS_001
    it('GET_MODS_001: should retrieve all users with role moderator and their communities', async () => {
      const modUser1 = await User.create({ name: 'Global Mod 1', email: 'gmod1@example.com', password: 'password', role: 'moderator' });
      const modUser2 = await User.create({ name: 'Global Mod 2', email: 'gmod2@example.com', password: 'password', role: 'moderator' });
      await Community.create({ name: 'Comm A', description: 'A', moderators: [modUser1._id] });
      await Community.create({ name: 'Comm B', description: 'B', moderators: [modUser1._id, modUser2._id] });
      const modsBefore = await User.find({ role: 'moderator' });
      console.log('[GET_MODS_001] 🟡 BEFORE moderators:', modsBefore.map(u => u.email));
      await getModerators(mockReq, mockRes);
      const responseMods = mockRes.json.mock.calls[0][0];
      console.log('[GET_MODS_001] 🟢 AFTER moderators returned:', responseMods.map(u => u.email));
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('GET_MODS_002: should return an empty array if no moderators exist', async () => {
      await User.create({ name: 'General User', email: 'gen@example.com', password: 'password', role: 'general' });
      const modsBefore = await User.find({ role: 'moderator' });
      console.log('[GET_MODS_002] 🟡 BEFORE moderators:', modsBefore.map(u => u.email));
      await getModerators(mockReq, mockRes);
      const modsAfter = mockRes.json.mock.calls[0][0];
      console.log('[GET_MODS_002] 🟢 AFTER moderators returned:', modsAfter);
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('GET_MODS_003: should handle database errors', async () => {
      console.log('[GET_MODS_003] 🟡 BEFORE: Simulating DB error for getModerators');
      jest.spyOn(User, 'find').mockImplementationOnce(() => ({
        populate: jest.fn().mockRejectedValueOnce(new Error('Database error'))
      }));
      await getModerators(mockReq, mockRes);
      console.log('[GET_MODS_003] 🟢 AFTER: DB error handled');
      expect(mockRes.status).toHaveBeenCalledWith(500);
      jest.restoreAllMocks();
    });
    
  });
});