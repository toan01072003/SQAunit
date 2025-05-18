// ✅ Updated Test File with printState for Rule Management
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Community = require('../../../models/community.model');
const Rule = require('../../../models/rule.model');
const Admin = require('../../../models/admin.model');
const bcrypt = require('bcrypt');

const { addRules, addRulesToCommunity } = require('../../../controllers/admin.controller');

let mongoServer;
let adminUser;

const printRulesAndCommunity = async (testId, label, communityId = null) => {
  const rules = await Rule.find();
  console.log(`[${testId}] ${label} Rules:`, rules.map(r => r.title));
  if (communityId) {
    const community = await Community.findById(communityId).populate('rules');
    console.log(`[${testId}] ${label} Community rules:`, community?.rules.map(r => r.title) || []);
  }
};

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

  const hashedPassword = await bcrypt.hash('adminpassword', 10);
  adminUser = new Admin({ username: 'testadminrule', password: hashedPassword });
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
  await Rule.deleteMany({});
  await Community.deleteMany({});

  const existingAdmin = await Admin.findOne({ username: 'testadminrule' });
  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash('adminpassword', 10);
    adminUser = new Admin({ _id: adminUser._id, username: 'testadminrule', password: hashedPassword });
    await adminUser.save();
  }
});

describe('Admin Rule Management Tests', () => {
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

  describe('addRules (Admin)', () => {
    it('ADMIN_ADD_RULES_001: should add new rules successfully', async () => {
      mockReq.body = [
        { title: 'Rule A', description: 'No spamming' },
        { title: 'Rule B', description: 'Be respectful' }
      ];
      await printRulesAndCommunity('ADMIN_ADD_RULES_001', '🟡 BEFORE');
      await addRules(mockReq, mockRes);
      await printRulesAndCommunity('ADMIN_ADD_RULES_001', '🟢 AFTER');

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toEqual(expect.arrayContaining([
        expect.objectContaining({ title: 'Rule A' }),
        expect.objectContaining({ title: 'Rule B' })
      ]));
      const rulesInDb = await Rule.find({});
      expect(rulesInDb.length).toBe(2);
    });

    it('ADMIN_ADD_RULES_002: should handle database error during rule insertion', async () => {
      mockReq.body = [{ title: 'Rule C', description: 'Fail this' }];
      await printRulesAndCommunity('ADMIN_ADD_RULES_002', '🟡 BEFORE');
      jest.spyOn(Rule, 'insertMany').mockRejectedValueOnce(new Error('DB insert failed'));
      await addRules(mockReq, mockRes);
      await printRulesAndCommunity('ADMIN_ADD_RULES_002', '🟢 AFTER');

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

    it('ADMIN_ADD_RULES_TO_COMM_001: should add all existing rules to a specific community', async () => {
      mockReq.params.communityId = community._id.toString();
      await printRulesAndCommunity('ADMIN_ADD_RULES_TO_COMM_001', '🟡 BEFORE', community._id);
      await addRulesToCommunity(mockReq, mockRes);
      await printRulesAndCommunity('ADMIN_ADD_RULES_TO_COMM_001', '🟢 AFTER', community._id);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      const updatedComm = mockRes.json.mock.calls[0][0];
      expect(updatedComm.rules.length).toBe(2);
    });

    it('ADMIN_ADD_RULES_TO_COMM_002: should return 404 if community not found', async () => {
      mockReq.params.communityId = new mongoose.Types.ObjectId().toString();
      await printRulesAndCommunity('ADMIN_ADD_RULES_TO_COMM_002', '🟡 BEFORE');
      await addRulesToCommunity(mockReq, mockRes);
      await printRulesAndCommunity('ADMIN_ADD_RULES_TO_COMM_002', '🟢 AFTER');

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Community not found' });
    });

    it('ADMIN_ADD_RULES_TO_COMM_003: should handle case where no rules exist in DB (adds empty array)', async () => {
      await Rule.deleteMany({});
      mockReq.params.communityId = community._id.toString();
      await printRulesAndCommunity('ADMIN_ADD_RULES_TO_COMM_003', '🟡 BEFORE', community._id);
      await addRulesToCommunity(mockReq, mockRes);
      await printRulesAndCommunity('ADMIN_ADD_RULES_TO_COMM_003', '🟢 AFTER', community._id);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      const updatedComm = mockRes.json.mock.calls[0][0];
      expect(updatedComm.rules.length).toBe(0);
    });

    it('ADMIN_ADD_RULES_TO_COMM_004: should handle database error during update', async () => {
      mockReq.params.communityId = community._id.toString();
      await printRulesAndCommunity('ADMIN_ADD_RULES_TO_COMM_004', '🟡 BEFORE', community._id);
      jest.spyOn(Community, 'findByIdAndUpdate').mockImplementationOnce(() => ({
        populate: jest.fn().mockRejectedValueOnce(new Error('DB update failed'))
      }));
      await addRulesToCommunity(mockReq, mockRes);
      await printRulesAndCommunity('ADMIN_ADD_RULES_TO_COMM_004', '🟢 AFTER', community._id);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Error adding rules to community' });
      jest.restoreAllMocks();
    });
  });
});
