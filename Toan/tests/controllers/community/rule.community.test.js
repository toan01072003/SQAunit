const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Community = require('../../../models/community.model');
const User = require('../../../models/user.model');
const Rule = require('../../../models/rule.model');

const {
  addRules,
  addRulesToCommunity,
} = require('../../../controllers/community.controller');

let mongoServer;
let mockUser;
let session;

const printState = async (testId, label) => {
  const rules = await Rule.find();
  const communities = await Community.find().populate('rules');
  console.log(`\n[${testId}] ${label} RULES:`, rules.map(r => r.title));
  console.log(`[${testId}] ${label} COMMUNITIES:`, communities.map(c => ({ name: c.name, rules: c.rules.map(r => r.title) })));
};

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  session = await mongoose.startSession();
  session.startTransaction();

  mockUser = new User({ name: 'Test User', email: 'test@example.com', password: 'password' });
  await mockUser.save({ session }); // Save user within transaction
});

afterEach(async () => {
  await session.abortTransaction(); // Rollback changes
  await session.endSession();
});

describe('Community Rule Management Tests (Community Controller)', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    mockReq = {
      body: {},
      query: {},
      params: {},
      userId: mockUser._id.toString(),
      headers: {
        authorization: 'Bearer mockToken'
      }
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      send: jest.fn(),
    };
  });

  describe('addRules', () => {
    it('ADD_RULES_001: should add new rules successfully', async () => {
      mockReq.body = [
        { title: 'Rule 1', description: 'No spamming' },
        { title: 'Rule 2', description: 'Be respectful' }
      ];
      await printState('ADD_RULES_001', '🟡 BEFORE');
      await addRules(mockReq, mockRes);
      await printState('ADD_RULES_001', '🟢 AFTER');

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({ title: 'Rule 1' }),
        expect.objectContaining({ title: 'Rule 2' }),
      ]));

      const rulesInDb = await Rule.find({ title: { $in: ['Rule 1', 'Rule 2'] } });
      expect(rulesInDb.length).toBe(2);
    });

    it('ADD_RULES_002: should handle duplicate rule title (unique constraint)', async () => {
      await Rule.create([{ title: 'Unique Rule', description: 'Existing one' }], { session });
      mockReq.body = [{ title: 'Unique Rule', description: 'Duplicate one' }];
      await printState('ADD_RULES_002', '🟡 BEFORE');
      await addRules(mockReq, mockRes);
      await printState('ADD_RULES_002', '🟢 AFTER');

      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Error creating rules' });
    });

    it('ADD_RULES_003: should handle generic DB insert error', async () => {
      mockReq.body = [{ title: 'Any Title', description: 'Desc' }];
      jest.spyOn(Rule, 'insertMany').mockRejectedValueOnce(new Error('Simulated DB error'));
      await printState('ADD_RULES_003', '🟡 BEFORE');
      await addRules(mockReq, mockRes);
      await printState('ADD_RULES_003', '🟢 AFTER');

      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Error creating rules' });
      jest.restoreAllMocks();
    });
  });

  describe('addRulesToCommunity', () => {
    let community;
    let rule1, rule2;

    beforeEach(async () => {
      community = await Community.create([{ name: 'TargetCommunity', description: 'A community' }], { session });
      rule1 = await Rule.create([{ title: 'Global Rule 1', description: 'GR1 Desc' }], { session });
      rule2 = await Rule.create([{ title: 'Global Rule 2', description: 'GR2 Desc' }], { session });
      mockReq.params.name = 'TargetCommunity';
    });

    it('ADD_RULES_TO_COMMUNITY_001: should add all existing rules to a community', async () => {
      await printState('ADD_RULES_TO_COMMUNITY_001', '🟡 BEFORE');
      await addRulesToCommunity(mockReq, mockRes);
      await printState('ADD_RULES_TO_COMMUNITY_001', '🟢 AFTER');

      expect(mockRes.status).toHaveBeenCalledWith(201);
      const updatedCommunity = await Community.findById(community[0]._id).populate('rules');
      expect(updatedCommunity.rules.length).toBe(2);
      expect(updatedCommunity.rules.map(r => r.title)).toEqual(expect.arrayContaining(['Global Rule 1', 'Global Rule 2']));

      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        name: 'TargetCommunity',
        rules: expect.arrayContaining([
          expect.objectContaining({ title: 'Global Rule 1' }),
          expect.objectContaining({ title: 'Global Rule 2' })
        ])
      }));
    });

    it('ADD_RULES_TO_COMMUNITY_002: should return 404 if community is not found', async () => {
      mockReq.params.name = 'NonExistentCommunity';
      await printState('ADD_RULES_TO_COMMUNITY_002', '🟡 BEFORE');
      await addRulesToCommunity(mockReq, mockRes);
      await printState('ADD_RULES_TO_COMMUNITY_002', '🟢 AFTER');
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Community not found' });
    });

    it('ADD_RULES_TO_COMMUNITY_003: should return 409 if DB error occurs during rule fetching', async () => {
      jest.spyOn(Rule, 'find').mockRejectedValueOnce(new Error('Simulated DB error'));
      await printState('ADD_RULES_TO_COMMUNITY_003', '🟡 BEFORE');
      await addRulesToCommunity(mockReq, mockRes);
      await printState('ADD_RULES_TO_COMMUNITY_003', '🟢 AFTER');
      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Error adding rules to community' });
      jest.restoreAllMocks();
    });

    it('ADD_RULES_TO_COMMUNITY_004: should handle case where no global rules exist', async () => {
      await Rule.deleteMany({}, { session });
      await printState('ADD_RULES_TO_COMMUNITY_004', '🟡 BEFORE');
      await addRulesToCommunity(mockReq, mockRes);
      await printState('ADD_RULES_TO_COMMUNITY_004', '🟢 AFTER');

      expect(mockRes.status).toHaveBeenCalledWith(201);
      const updatedCommunity = await Community.findById(community[0]._id).populate('rules');
      expect(updatedCommunity.rules.length).toBe(0);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        name: 'TargetCommunity',
        rules: []
      }));
    });
  });
});
