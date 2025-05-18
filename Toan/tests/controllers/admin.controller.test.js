const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server'); // Ensure this is installed
const Admin = require('../../models/admin.model');
const Community = require('../../models/community.model');
const Config = require('../../models/config.model');
const Log = require('../../models/log.model');
const User = require('../../models/user.model');
const Rule = require('../../models/rule.model'); // Added Rule model
const AdminToken = require('../../models/token.admin.model'); // Added for signin if deeper DB check is needed
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken'); // For checking token structure if needed

const {
  signin,
  retrieveLogInfo,
  deleteLogInfo,
  updateServicePreference,
  retrieveServicePreference,
  getCommunities,
  getCommunity,
  addModerator,
  removeModerator,
  getModerators,
  addRules, // Assuming this is part of admin controller as per imports
  addRulesToCommunity, // Assuming this is part of admin controller
} = require('../../controllers/admin.controller');

let mongoServer;
let adminUser; // For authenticated requests if middleware was more deeply tested

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

  // Create a mock admin for potential use in tests requiring an admin context
  const hashedPassword = await bcrypt.hash('adminpassword', 10);
  adminUser = new Admin({ username: 'testadmin', password: hashedPassword });
  await adminUser.save();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  // Clear all collections before each test to ensure isolation
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
  // Re-create adminUser if it was deleted or modified in a test
  const existingAdmin = await Admin.findOne({ username: 'testadmin' });
  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash('adminpassword', 10);
    adminUser = new Admin({ username: 'testadmin', password: hashedPassword });
    await adminUser.save();
  }
});


describe('Admin Controller Tests', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    mockReq = {
      body: {},
      query: {},
      params: {},
      // If your requireAdminAuth middleware decodes and attaches admin user:
      // admin: { id: adminUser._id.toString(), username: adminUser.username },
      headers: {
        authorization: 'Bearer mockAdminToken' // Mock token for middleware
      }
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      send: jest.fn(),
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
      // Admin.findOne will be mocked by Jest if specific behavior is needed,
      // otherwise, it will query the empty (or cleared) DB.
      // jest.spyOn(Admin, 'findOne').mockResolvedValue(null); // Already handled by empty DB

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
      // bcrypt.compare will be called internally. We don't need to mock it here
      // unless we want to force a specific outcome of the comparison.

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
      jest.spyOn(Log, 'find').mockImplementation(() => ({ // Mocking the chained calls
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockRejectedValue(new Error('Database error'))
      }));
      
      await retrieveLogInfo(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(500);
      // The actual controller has a generic "Internal server error" for this.
      // Let's adjust the expectation to match the controller's actual error message.
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Internal server error' }); 
      jest.restoreAllMocks();
    });

    // Test ID: LOG_003
    // Purpose: Verify system handles empty log results appropriately
    it('LOG_003: should handle empty log results', async () => {
      // No logs in DB due to beforeEach cleanup
      await retrieveLogInfo(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith([]);
    });
  });

  describe('updateServicePreference', () => {
    // Test ID: PREF_001
    // Purpose: Verify successful update of service preferences
    it('PREF_001: should update service preferences successfully', async () => {
      mockReq.body = {
        usePerspectiveAPI: true,
        categoryFilteringServiceProvider: 'mock-provider',
        categoryFilteringRequestTimeout: 5000
      };

      const mockConfig = {
        ...mockReq.body
      };

      jest.spyOn(Config, 'findOneAndUpdate').mockResolvedValue(mockConfig);

      await updateServicePreference(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(mockConfig);
    });

    // Test ID: PREF_002
    // Purpose: Verify system handles database errors during preference update
    it('PREF_002: should handle errors when updating preferences', async () => {
      mockReq.body = {
        usePerspectiveAPI: true
      };

      jest.spyOn(Config, 'findOneAndUpdate').mockRejectedValue(new Error('Database error'));

      await updateServicePreference(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Error updating system preferences'
      });
    });
  });

  describe('getCommunities (Admin)', () => {
    // Test ID: GET_ADMIN_COMMUNITIES_001
    it('GET_ADMIN_COMMUNITIES_001: should retrieve all communities with selected fields', async () => {
      await Community.insertMany([
        { name: 'Tech World', description: 'Tech discussions', banner: 'tech.jpg' },
        { name: 'Gamers Hub', description: 'Gaming community', banner: 'game.png' },
      ]);
      await getCommunities(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({ name: 'Tech World', banner: 'tech.jpg' }),
        expect.objectContaining({ name: 'Gamers Hub', banner: 'game.png' }),
      ]));
      expect(mockRes.json.mock.calls[0][0].length).toBe(2);
      // Check that only selected fields are returned
      expect(mockRes.json.mock.calls[0][0][0].description).toBeUndefined();
    });

    // Test ID: GET_ADMIN_COMMUNITIES_002
    it('GET_ADMIN_COMMUNITIES_002: should return an empty array if no communities exist', async () => {
      await getCommunities(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith([]);
    });
    
    // Test ID: GET_ADMIN_COMMUNITIES_003
    it('GET_ADMIN_COMMUNITIES_003: should handle database errors', async () => {
        jest.spyOn(Community, 'find').mockImplementationOnce(() => ({
            select: jest.fn().mockRejectedValueOnce(new Error('Database error'))
        }));
        await getCommunities(mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({ message: 'Error retrieving communities' });
        jest.restoreAllMocks();
    });
  });

  describe('getCommunity (Admin)', () => {
    let community1, user1, user2;
    beforeEach(async () => {
        user1 = await User.create({ name: 'ModUser1', email: 'mod1@example.com', password: 'password' });
        user2 = await User.create({ name: 'MemberUser1', email: 'member1@example.com', password: 'password' });
        community1 = await Community.create({ 
            name: 'Detail Community', 
            description: 'Details here', 
            moderators: [user1._id], 
            members: [user1._id, user2._id] 
        });
    });

    // Test ID: GET_ADMIN_COMMUNITY_001
    it('GET_ADMIN_COMMUNITY_001: should retrieve a specific community by ID with populated details', async () => {
      mockReq.params.communityId = community1._id.toString();
      await getCommunity(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      const resCommunity = mockRes.json.mock.calls[0][0];
      expect(resCommunity.name).toBe('Detail Community');
      expect(resCommunity.moderators.length).toBe(1);
      expect(resCommunity.moderators[0].name).toBe('ModUser1');
      expect(resCommunity.members.length).toBe(2);
    });

    // Test ID: GET_ADMIN_COMMUNITY_002
    it('GET_ADMIN_COMMUNITY_002: should return 404 if community not found', async () => {
      mockReq.params.communityId = new mongoose.Types.ObjectId().toString();
      await getCommunity(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Community not found' });
    });

    // Test ID: GET_ADMIN_COMMUNITY_003
    it('GET_ADMIN_COMMUNITY_003: should handle database errors', async () => {
        mockReq.params.communityId = community1._id.toString();
        jest.spyOn(Community, 'findById').mockImplementationOnce(() => ({
            populate: jest.fn().mockReturnThis(),
            populate: jest.fn().mockRejectedValueOnce(new Error('Database error')) // Second populate for members
        }));
        await getCommunity(mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({ message: 'Error retrieving community details' });
        jest.restoreAllMocks();
    });
  });

  describe('addModerator', () => {
    let community, user;
    beforeEach(async () => {
        community = await Community.create({ name: 'Mod Test Comm', description: 'Test' });
        user = await User.create({ name: 'Potential Mod', email: 'potmod@example.com', password: 'password', role: 'general' });
    });

    // Test ID: ADD_MOD_001
    it('ADD_MOD_001: should add a user as a moderator and update user role', async () => {
      mockReq.body = { communityId: community._id.toString(), userId: user._id.toString() };
      await addModerator(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Moderator added successfully' });

      const updatedCommunity = await Community.findById(community._id);
      expect(updatedCommunity.moderators).toContainEqual(user._id);
      const updatedUser = await User.findById(user._id);
      expect(updatedUser.role).toBe('moderator');
    });

    // Test ID: ADD_MOD_002
    it('ADD_MOD_002: should return 404 if community not found', async () => {
      mockReq.body = { communityId: new mongoose.Types.ObjectId().toString(), userId: user._id.toString() };
      await addModerator(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Community not found' });
    });
    
    // Test ID: ADD_MOD_003
    it('ADD_MOD_003: should return 404 if user not found', async () => {
      mockReq.body = { communityId: community._id.toString(), userId: new mongoose.Types.ObjectId().toString() };
      await addModerator(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'User not found' });
    });

    // Test ID: ADD_MOD_004
    it('ADD_MOD_004: should return 400 if user is already a moderator', async () => {
      await Community.findByIdAndUpdate(community._id, { $addToSet: { moderators: user._id } });
      await User.findByIdAndUpdate(user._id, { role: 'moderator' });
      mockReq.body = { communityId: community._id.toString(), userId: user._id.toString() };
      
      await addModerator(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'User is already a moderator in this community' });
    });
    
    // Test ID: ADD_MOD_005
    it('ADD_MOD_005: should handle database errors during update', async () => {
        mockReq.body = { communityId: community._id.toString(), userId: user._id.toString() };
        jest.spyOn(Community, 'findByIdAndUpdate').mockRejectedValueOnce(new Error('DB error'));
        await addModerator(mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({ message: 'Error adding moderator' });
        jest.restoreAllMocks();
    });
  });

  describe('removeModerator', () => {
    let community, user;
    beforeEach(async () => {
        user = await User.create({ name: 'Current Mod', email: 'curmod@example.com', password: 'password', role: 'moderator' });
        community = await Community.create({ name: 'Mod Removal Comm', description: 'Test', moderators: [user._id] });
    });

    // Test ID: REMOVE_MOD_001
    it('REMOVE_MOD_001: should remove a moderator and update user role to general', async () => {
      mockReq.body = { communityId: community._id.toString(), userId: user._id.toString() };
      await removeModerator(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Moderator removed successfully' });

      const updatedCommunity = await Community.findById(community._id);
      expect(updatedCommunity.moderators).not.toContainEqual(user._id);
      const updatedUser = await User.findById(user._id);
      expect(updatedUser.role).toBe('general');
    });

    // Test ID: REMOVE_MOD_002
    it('REMOVE_MOD_002: should return 404 if community not found', async () => {
        mockReq.body = { communityId: new mongoose.Types.ObjectId().toString(), userId: user._id.toString() };
        await removeModerator(mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(404);
        expect(mockRes.json).toHaveBeenCalledWith({ message: 'Community not found' });
    });

    // Test ID: REMOVE_MOD_003
    it('REMOVE_MOD_003: should return 404 if user not found', async () => {
        mockReq.body = { communityId: community._id.toString(), userId: new mongoose.Types.ObjectId().toString() };
        await removeModerator(mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(404);
        expect(mockRes.json).toHaveBeenCalledWith({ message: 'User not found' });
    });
    
    // Test ID: REMOVE_MOD_004
    it('REMOVE_MOD_004: should return 400 if user is not a moderator of this community', async () => {
        const nonModUser = await User.create({ name: 'Not A Mod', email: 'notamod@example.com', password: 'password' });
        mockReq.body = { communityId: community._id.toString(), userId: nonModUser._id.toString() };
        await removeModerator(mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({ message: 'User is not a moderator of this community' });
    });

    // Test ID: REMOVE_MOD_005
    it('REMOVE_MOD_005: should handle database errors during removal', async () => {
        mockReq.body = { communityId: community._id.toString(), userId: user._id.toString() };
        jest.spyOn(User, 'findByIdAndUpdate').mockRejectedValueOnce(new Error('DB error'));
        await removeModerator(mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({ message: 'Error removing moderator' });
        jest.restoreAllMocks();
    });
  });

  describe('getModerators', () => {
    // Test ID: GET_MODS_001
    it('GET_MODS_001: should retrieve all users with role moderator and their communities', async () => {
      const modUser1 = await User.create({ name: 'Global Mod 1', email: 'gmod1@example.com', password: 'password', role: 'moderator' });
      const modUser2 = await User.create({ name: 'Global Mod 2', email: 'gmod2@example.com', password: 'password', role: 'moderator' });
      await User.create({ name: 'General User', email: 'gen@example.com', password: 'password', role: 'general' });
      
      const comm1 = await Community.create({ name: 'Comm A', description: 'A', moderators: [modUser1._id] });
      const comm2 = await Community.create({ name: 'Comm B', description: 'B', moderators: [modUser1._id, modUser2._id] });

      await getModerators(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      const responseMods = mockRes.json.mock.calls[0][0];
      expect(responseMods.length).toBe(2); // Only modUser1 and modUser2

      const resMod1 = responseMods.find(m => m.email === 'gmod1@example.com');
      const resMod2 = responseMods.find(m => m.email === 'gmod2@example.com');
      
      expect(resMod1.moderatedCommunities.length).toBe(2);
      expect(resMod1.moderatedCommunities).toEqual(expect.arrayContaining([
          expect.objectContaining({ name: 'Comm A' }),
          expect.objectContaining({ name: 'Comm B' })
      ]));
      expect(resMod2.moderatedCommunities.length).toBe(1);
      expect(resMod2.moderatedCommunities[0].name).toBe('Comm B');
    });

    // Test ID: GET_MODS_002
    it('GET_MODS_002: should return an empty array if no moderators exist', async () => {
      await User.create({ name: 'General User', email: 'gen@example.com', password: 'password', role: 'general' });
      await getModerators(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith([]);
    });
    
    // Test ID: GET_MODS_003
    it('GET_MODS_003: should handle database errors', async () => {
        jest.spyOn(User, 'find').mockImplementationOnce(() => ({
            populate: jest.fn().mockRejectedValueOnce(new Error('Database error'))
        }));
        await getModerators(mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({ message: 'Error retrieving moderators' });
        jest.restoreAllMocks();
    });
  });
  
  describe('addRules (Admin)', () => {
    // Test ID: ADMIN_ADD_RULES_001
    it('ADMIN_ADD_RULES_001: should add new rules successfully', async () => {
        mockReq.body = [
            { title: 'Rule A', description: 'No spamming' },
            { title: 'Rule B', description: 'Be respectful' }
        ];
        await addRules(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(201);
        expect(mockRes.json).toEqual(expect.arrayContaining([
            expect.objectContaining({ title: 'Rule A' }),
            expect.objectContaining({ title: 'Rule B' })
        ]));
        const rulesInDb = await Rule.find({});
        expect(rulesInDb.length).toBe(2);
    });

    // Test ID: ADMIN_ADD_RULES_002
    it('ADMIN_ADD_RULES_002: should handle database error during rule insertion', async () => {
        mockReq.body = [{ title: 'Rule C', description: 'Fail this' }];
        jest.spyOn(Rule, 'insertMany').mockRejectedValueOnce(new Error('DB insert failed'));
        await addRules(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(409);
        expect(mockRes.json).toHaveBeenCalledWith({ message: 'Error creating rules' });
        jest.restoreAllMocks();
    });
  });

  describe('addRulesToCommunity (Admin)', () => {
    let community, rule1, rule2;
    beforeEach(async () => {
        community = await Community.create({ name: 'RuleTargetComm', description: 'Target' });
        rule1 = await Rule.create({ title: 'Global Rule 1', description: 'Desc 1' });
        rule2 = await Rule.create({ title: 'Global Rule 2', description: 'Desc 2' });
    });

    // Test ID: ADMIN_ADD_RULES_TO_COMM_001
    it('ADMIN_ADD_RULES_TO_COMM_001: should add all existing rules to a specific community', async () => {
        mockReq.params.communityId = community._id.toString();
        await addRulesToCommunity(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(200); // Controller returns 200
        const updatedComm = mockRes.json.mock.calls[0][0];
        expect(updatedComm.rules.length).toBe(2);
        // Note: The controller populates rules, so we check for objects, not just IDs
        expect(updatedComm.rules).toEqual(expect.arrayContaining([
            expect.objectContaining({ title: 'Global Rule 1' }),
            expect.objectContaining({ title: 'Global Rule 2' })
        ]));

        const commInDb = await Community.findById(community._id).populate('rules');
        expect(commInDb.rules.length).toBe(2);
    });

    // Test ID: ADMIN_ADD_RULES_TO_COMM_002
    it('ADMIN_ADD_RULES_TO_COMM_002: should return 404 if community not found', async () => {
        mockReq.params.communityId = new mongoose.Types.ObjectId().toString();
        await addRulesToCommunity(mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(404);
        expect(mockRes.json).toHaveBeenCalledWith({ message: 'Community not found' });
    });

    // Test ID: ADMIN_ADD_RULES_TO_COMM_003
    it('ADMIN_ADD_RULES_TO_COMM_003: should handle case where no rules exist in DB (adds empty array)', async () => {
        await Rule.deleteMany({}); // Remove all rules
        mockReq.params.communityId = community._id.toString();
        await addRulesToCommunity(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(200);
        const updatedComm = mockRes.json.mock.calls[0][0];
        expect(updatedComm.rules.length).toBe(0);
    });
    
    // Test ID: ADMIN_ADD_RULES_TO_COMM_004
    it('ADMIN_ADD_RULES_TO_COMM_004: should handle database error during update', async () => {
        mockReq.params.communityId = community._id.toString();
        jest.spyOn(Community, 'findByIdAndUpdate').mockImplementationOnce(() => ({
            populate: jest.fn().mockRejectedValueOnce(new Error('DB update failed'))
        }));
        await addRulesToCommunity(mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({ message: 'Error adding rules to community' });
        jest.restoreAllMocks();
    });
  });
});
