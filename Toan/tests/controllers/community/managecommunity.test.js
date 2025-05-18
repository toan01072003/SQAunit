// ✅ Test File with BEFORE / AFTER logs for Community Controller
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Community = require('../../../models/community.model');
const User = require('../../../models/user.model');
const Rule = require('../../../models/rule.model');

const {
  getCommunities,
  getCommunity,
  createCommunity,
} = require('../../../controllers/community.controller');

let mongoServer;
let mockUser;

const printCommunities = async (testId, label) => {
  const communities = await Community.find().populate('rules');
  console.log(`[${testId}] ${label} Communities:`, communities.map(c => c.name));
};

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  mockUser = new User({ name: 'Test User', email: 'test@example.com', password: 'password' });
  await mockUser.save();
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
  const existingUser = await User.findById(mockUser._id);
  if (!existingUser) {
    mockUser = new User({ _id: mockUser._id, name: 'Test User', email: 'test@example.com', password: 'password' });
    await mockUser.save();
  }
});

describe('Community Management Tests (Community Controller)', () => {
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

  describe('getCommunities', () => {
    it('GET_COMMUNITIES_001: should retrieve all communities successfully', async () => {
      const communityData = [{ name: 'Community 1', description: 'Desc 1' }, { name: 'Community 2', description: 'Desc 2' }];
      await Community.insertMany(communityData);
      await printCommunities('GET_COMMUNITIES_001', '🟡 BEFORE');

      await getCommunities(mockReq, mockRes);

      await printCommunities('GET_COMMUNITIES_001', '🟢 AFTER');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({ name: 'Community 1' }),
        expect.objectContaining({ name: 'Community 2' }),
      ]));
      expect(mockRes.json.mock.calls[0][0].length).toBe(2);
    });

    it('GET_COMMUNITIES_002: should return an empty array if no communities exist', async () => {
      await printCommunities('GET_COMMUNITIES_002', '🟡 BEFORE');

      await getCommunities(mockReq, mockRes);

      await printCommunities('GET_COMMUNITIES_002', '🟢 AFTER');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith([]);
    });

    it('GET_COMMUNITIES_003: should handle database errors during retrieval', async () => {                               
      jest.spyOn(Community, 'find').mockImplementationOnce(() => {                                                        
        throw new Error('Database error');                                                                                
      });                                                                                                                 

      await printCommunities('GET_COMMUNITIES_003', '🟡 BEFORE');

      await getCommunities(mockReq, mockRes);

      await printCommunities('GET_COMMUNITIES_003', '🟢 AFTER');
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'No communities found' });
      jest.restoreAllMocks();
    });
  });

  describe('getCommunity', () => {
    it('GET_COMMUNITY_001: should retrieve a specific community by name successfully', async () => {
      const rule = await Rule.create({ title: 'Rule 1', description: 'No spam', rule: 'Rule 1: No spamming is allowed.' }); // Added the 'rule' field
      const community = await Community.create({ name: 'TechTalk', description: 'Discussions about tech', rules: [rule._id] });
      mockReq.params.name = 'TechTalk';
      await printCommunities('GET_COMMUNITY_001', '🟡 BEFORE');

      await getCommunity(mockReq, mockRes);

      await printCommunities('GET_COMMUNITY_001', '🟢 AFTER');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        name: 'TechTalk',
        description: 'Discussions about tech',
        rules: expect.arrayContaining([expect.objectContaining({ title: 'Rule 1' })]),
      }));
    });

    it('GET_COMMUNITY_002: should return 404 if community is not found', async () => {
      mockReq.params.name = 'NonExistentCommunity';
      await printCommunities('GET_COMMUNITY_002', '🟡 BEFORE');
      await getCommunity(mockReq, mockRes);
      await printCommunities('GET_COMMUNITY_002', '🟢 AFTER');

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Community not found' });
    });

    it('GET_COMMUNITY_003: should handle database errors during retrieval', async () => {
      mockReq.params.name = 'TechTalk';
      jest.spyOn(Community, 'findOne').mockImplementationOnce(() => ({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockRejectedValue(new Error('Database error')),
      }));

      await printCommunities('GET_COMMUNITY_003', '🟡 BEFORE');
      await getCommunity(mockReq, mockRes);
      await printCommunities('GET_COMMUNITY_003', '🟢 AFTER');

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Community not found' });
      jest.restoreAllMocks();
    });
  });

  describe('createCommunity', () => {
    it('CREATE_COMMUNITY_001: should create one or more communities successfully', async () => {
      mockReq.body = [
        { name: 'New Community 1', description: 'Desc 1', banner: 'banner1.jpg' },
        { name: 'New Community 2', description: 'Desc 2' }
      ];
      await printCommunities('CREATE_COMMUNITY_001', '🟡 BEFORE');

      await createCommunity(mockReq, mockRes);

      await printCommunities('CREATE_COMMUNITY_001', '🟢 AFTER');
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({ name: 'New Community 1' }),
        expect.objectContaining({ name: 'New Community 2' }),
      ]));

      const communitiesInDb = await Community.find({ name: { $in: ['New Community 1', 'New Community 2'] } });
      expect(communitiesInDb.length).toBe(2);
    });

    it('CREATE_COMMUNITY_002: should handle error if community name already exists (or other DB errors)', async () => {
      await Community.create({ name: 'Existing Community', description: 'Test' });
      mockReq.body = [{ name: 'Existing Community', description: 'Another desc' }];
      jest.spyOn(Community, 'insertMany').mockRejectedValueOnce(new Error('Simulated DB error'));

      await printCommunities('CREATE_COMMUNITY_002', '🟡 BEFORE');
      await createCommunity(mockReq, mockRes);
      await printCommunities('CREATE_COMMUNITY_002', '🟢 AFTER');

      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Error creating community' });
      jest.restoreAllMocks();
    });

    it('CREATE_COMMUNITY_003: should handle empty request body gracefully', async () => {
      mockReq.body = [];
      await printCommunities('CREATE_COMMUNITY_003', '🟡 BEFORE');

      await createCommunity(mockReq, mockRes);

      await printCommunities('CREATE_COMMUNITY_003', '🟢 AFTER');
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith([]);
      const communitiesInDb = await Community.countDocuments();
      expect(communitiesInDb).toBe(0);
    });
  });
});
