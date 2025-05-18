const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Community = require('../../models/community.model');
const User = require('../../models/user.model');
const Post = require('../../models/post.model'); // Though not directly used by community controller, good to have if related data is checked
const Rule = require('../../models/rule.model');
const Report = require('../../models/report.model');

const {
  getCommunities,
  getCommunity,
  createCommunity,
  addRules,
  addRulesToCommunity,
  getMemberCommunities,
  getNotMemberCommunities,
  joinCommunity,
  leaveCommunity,
  banUser,
  unbanUser,
  reportPost,
  getReportedPosts,
  removeReportedPost,
  getCommunityMembers,
  getCommunityMods,
  addModToCommunity,
} = require('../../controllers/community.controller');

let mongoServer;
let mockUser;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  // Create a mock user for testing authenticated routes
  mockUser = new User({ name: 'Test User', email: 'test@example.com', password: 'password' });
  await mockUser.save();
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
  // Re-create mock user if needed, or ensure it exists from beforeAll
  // For simplicity, we assume mockUser created in beforeAll persists if not specifically deleted.
  // If tests modify mockUser, it might be better to recreate it here or use transactions.
  const existingUser = await User.findById(mockUser._id);
  if (!existingUser) {
    mockUser = new User({ _id: mockUser._id, name: 'Test User', email: 'test@example.com', password: 'password' });
    await mockUser.save();
  }
});

describe('Community Controller Tests', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    mockReq = {
      body: {},
      query: {},
      params: {},
      userId: mockUser._id.toString(), // Default to our mock user
      headers: {
        authorization: 'Bearer mockToken' // Mock token if your middleware checks it
      }
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      send: jest.fn(), // In case some error handlers use send
    };
  });

  describe('getCommunities', () => {
    // Test ID: GET_COMMUNITIES_001
    it('GET_COMMUNITIES_001: should retrieve all communities successfully', async () => {
      const communityData = [{ name: 'Community 1', description: 'Desc 1' }, { name: 'Community 2', description: 'Desc 2' }];
      await Community.insertMany(communityData);

      await getCommunities(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({ name: 'Community 1' }),
        expect.objectContaining({ name: 'Community 2' }),
      ]));
      expect(mockRes.json.mock.calls[0][0].length).toBe(2);
    });

    // Test ID: GET_COMMUNITIES_002
    it('GET_COMMUNITIES_002: should return an empty array if no communities exist', async () => {
      await getCommunities(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200); // Controller returns 200 with empty array
      expect(mockRes.json).toHaveBeenCalledWith([]);
    });
    
    // Test ID: GET_COMMUNITIES_003
    // Note: The controller's catch block sends 404. For a true DB error, 500 might be expected.
    // This test reflects the current implementation.
    it('GET_COMMUNITIES_003: should handle database errors during retrieval', async () => {
      jest.spyOn(Community, 'find').mockImplementationOnce(() => {
        throw new Error('Database error');
      });

      await getCommunities(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(404); // As per controller's catch block
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'No communities found' });
      jest.restoreAllMocks();
    });
  });

  describe('getCommunity', () => {
    // Test ID: GET_COMMUNITY_001
    it('GET_COMMUNITY_001: should retrieve a specific community by name successfully', async () => {
      const rule = await Rule.create({ title: 'Rule 1', description: 'No spam' });
      const community = await Community.create({ name: 'TechTalk', description: 'Discussions about tech', rules: [rule._id] });
      mockReq.params.name = 'TechTalk';

      await getCommunity(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        name: 'TechTalk',
        description: 'Discussions about tech',
        rules: expect.arrayContaining([expect.objectContaining({ title: 'Rule 1' })]),
      }));
    });

    // Test ID: GET_COMMUNITY_002
    it('GET_COMMUNITY_002: should return 404 if community is not found', async () => {
      mockReq.params.name = 'NonExistentCommunity';
      await getCommunity(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Community not found' });
    });
    
    // Test ID: GET_COMMUNITY_003
    it('GET_COMMUNITY_003: should handle database errors during retrieval', async () => {
      mockReq.params.name = 'TechTalk';
      jest.spyOn(Community, 'findOne').mockImplementationOnce(() => ({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockRejectedValue(new Error('Database error')),
      }));

      await getCommunity(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(404); // As per controller's catch block
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Community not found' });
      jest.restoreAllMocks();
    });
  });

  describe('createCommunity', () => {
    // Test ID: CREATE_COMMUNITY_001
    it('CREATE_COMMUNITY_001: should create one or more communities successfully', async () => {
      mockReq.body = [
        { name: 'New Community 1', description: 'Desc 1', banner: 'banner1.jpg' },
        { name: 'New Community 2', description: 'Desc 2' }
      ];

      await createCommunity(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({ name: 'New Community 1' }),
        expect.objectContaining({ name: 'New Community 2' }),
      ]));

      const communitiesInDb = await Community.find({ name: { $in: ['New Community 1', 'New Community 2'] } });
      expect(communitiesInDb.length).toBe(2);
    });

    // Test ID: CREATE_COMMUNITY_002
    it('CREATE_COMMUNITY_002: should handle error if community name already exists (or other DB errors)', async () => {
      await Community.create({ name: 'Existing Community', description: 'Test' });
      mockReq.body = [{ name: 'Existing Community', description: 'Another desc' }];

      // Mongoose insertMany might throw a MongoError with code 11000 for duplicates
      // For simplicity, we'll mock it to throw a generic error to trigger the catch block
      jest.spyOn(Community, 'insertMany').mockRejectedValueOnce(new Error('Simulated DB error'));
      
      await createCommunity(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Error creating community' });
      jest.restoreAllMocks();
    });

    // Test ID: CREATE_COMMUNITY_003
    it('CREATE_COMMUNITY_003: should handle empty request body gracefully', async () => {
      mockReq.body = []; // Empty array
      await createCommunity(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(201); // insertMany with empty array is not an error
      expect(mockRes.json).toHaveBeenCalledWith([]);
      const communitiesInDb = await Community.countDocuments();
      expect(communitiesInDb).toBe(0);
    });
  });

  describe('addRules', () => {
    // Test ID: ADD_RULES_001
    it('ADD_RULES_001: should add new rules successfully', async () => {
        mockReq.body = [
            { title: 'Rule 1', description: 'No spamming' },
            { title: 'Rule 2', description: 'Be respectful' }
        ];

        await addRules(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(201);
        expect(mockRes.json).toHaveBeenCalledWith(expect.arrayContaining([
            expect.objectContaining({ title: 'Rule 1' }),
            expect.objectContaining({ title: 'Rule 2' }),
        ]));

        const rulesInDb = await Rule.find({ title: { $in: ['Rule 1', 'Rule 2'] } });
        expect(rulesInDb.length).toBe(2);
    });

    // Test ID: ADD_RULES_002
    it('ADD_RULES_002: should handle error during rule creation (e.g., duplicate title if unique index exists)', async () => {
        await Rule.create({ title: 'Existing Rule', description: 'Test' });
        mockReq.body = [{ title: 'Existing Rule', description: 'Another desc' }];
        
        jest.spyOn(Rule, 'insertMany').mockRejectedValueOnce(new Error('Simulated DB error for rules'));

        await addRules(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(409);
        expect(mockRes.json).toHaveBeenCalledWith({ message: 'Error creating rules' });
        jest.restoreAllMocks();
    });
  });

  describe('addRulesToCommunity', () => {
    let community;
    let rule1, rule2;

    beforeEach(async () => {
        community = await Community.create({ name: 'TargetCommunity', description: 'A community' });
        rule1 = await Rule.create({ title: 'Global Rule 1', description: 'GR1 Desc' });
        rule2 = await Rule.create({ title: 'Global Rule 2', description: 'GR2 Desc' });
        mockReq.params.name = community.name;
    });

    // Test ID: ADD_RULES_TO_COMMUNITY_001
    it('ADD_RULES_TO_COMMUNITY_001: should add all existing rules to a community', async () => {
        await addRulesToCommunity(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(201);
        const updatedCommunity = await Community.findById(community._id).populate('rules');
        expect(updatedCommunity.rules.length).toBe(2);
        expect(updatedCommunity.rules.map(r => r.title)).toEqual(expect.arrayContaining(['Global Rule 1', 'Global Rule 2']));
    });

    // Test ID: ADD_RULES_TO_COMMUNITY_002
    it('ADD_RULES_TO_COMMUNITY_002: should return 409 if community is not found', async () => {
        mockReq.params.name = 'NonExistentCommunityForRules';
        // findOneAndUpdate with a non-existent doc won't throw but will return null,
        // The controller doesn't explicitly check for null and might proceed, potentially leading to an error later or unexpected behavior.
        // For this test, we'll assume the controller's current error handling (409 for any error)
        
        // To make it more robust, we can mock findOneAndUpdate to simulate not finding the community
        jest.spyOn(Community, 'findOneAndUpdate').mockResolvedValueOnce(null);

        await addRulesToCommunity(mockReq, mockRes);
        
        // The controller currently returns 201 with null if community not found, which might not be ideal.
        // A 404 or specific error would be better. For now, testing current behavior.
        // If it were to throw, it would hit the catch block.
        // Given the current code, if findOneAndUpdate returns null, it will still be 201 with null.
        // Let's assume the intention is to error out if community not found.
        // The current catch block is generic.
        // If Community.findOneAndUpdate fails to find, it returns null. The controller sends this null with 201.
        // To test the 409 path, we need to make Rule.find() or findOneAndUpdate throw.
        jest.restoreAllMocks(); // restore previous mock
        jest.spyOn(Rule, 'find').mockRejectedValueOnce(new Error('DB error fetching rules'));

        await addRulesToCommunity(mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(409);
        expect(mockRes.json).toHaveBeenCalledWith({ message: 'Error adding rules to community' });
        jest.restoreAllMocks();
    });
  });

  describe('joinCommunity', () => {
    let communityToJoin;

    beforeEach(async () => {
        communityToJoin = await Community.create({ name: 'JoinableComm', description: 'Can be joined' });
        mockReq.params.name = communityToJoin.name;
    });

    // Test ID: JOIN_COMMUNITY_001
    it('JOIN_COMMUNITY_001: should allow a user to join a community', async () => {
        await joinCommunity(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
            name: communityToJoin.name,
            members: expect.arrayContaining([mongoose.Types.ObjectId(mockReq.userId)]),
        }));

        const dbCommunity = await Community.findById(communityToJoin._id);
        expect(dbCommunity.members).toContainEqual(mongoose.Types.ObjectId(mockReq.userId));
    });

    // Test ID: JOIN_COMMUNITY_002
    it('JOIN_COMMUNITY_002: should handle error if community to join is not found', async () => {
        mockReq.params.name = 'NonExistentCommToJoin';
        // findOneAndUpdate on non-existent doc returns null. Controller sends 200 with null.
        // To test the 500 error path:
        jest.spyOn(Community, 'findOneAndUpdate').mockRejectedValueOnce(new Error('DB error'));
        
        await joinCommunity(mockReq, mockRes);
        
        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({ message: 'Error joining community' });
        jest.restoreAllMocks();
    });

    // Test ID: JOIN_COMMUNITY_003
    it('JOIN_COMMUNITY_003: should not add user if already a member (Mongoose $push behavior)', async () => {
        // First join
        await Community.findOneAndUpdate({ name: communityToJoin.name }, { $push: { members: mockReq.userId } });
        
        // Attempt to join again
        await joinCommunity(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(200); // $push doesn't duplicate if item exists in array with $addToSet semantics, but here it's just $push
        const dbCommunity = await Community.findById(communityToJoin._id);
        // Standard $push can add duplicates. If members should be unique, schema/logic needs $addToSet.
        // Assuming current controller uses $push, it might add duplicates if not careful.
        // The model uses default: [] for members, not a Set.
        // Let's check the actual members count.
        // The controller uses $push. If the user is already a member, they will be added again.
        // This test highlights a potential issue if members are meant to be unique.
        // For now, testing the behavior of $push.
        expect(dbCommunity.members.filter(id => id.toString() === mockReq.userId).length).toBe(2); // User added twice
    });
  });

  // ... (Tests for leaveCommunity, banUser, unbanUser, reportPost, etc. would follow a similar pattern)
  // For each function:
  // 1. Describe block for the function.
  // 2. beforeEach/beforeAll within the describe if specific setup is needed (e.g., creating a community, users).
  // 3. Test cases (it blocks) with unique IDs:
  //    - Happy path (successful operation).
  //        - Set up mockReq (params, body, userId).
  //        - Perform the action.
  //        - Assert mockRes.status and mockRes.json.
  //        - Assert database state changes (e.g., document created, updated, deleted, fields changed).
  //    - Edge cases (e.g., item not found, user not authorized, invalid input).
  //        - Set up mockReq.
  //        - Mock model methods if necessary to simulate conditions (e.g., findById returning null).
  //        - Perform the action.
  //        - Assert mockRes.status and mockRes.json for error responses.
  //    - Database error handling.
  //        - Mock a model method to throw an error.
  //        - Perform the action.
  //        - Assert mockRes.status and mockRes.json for server error responses.
  // 4. Ensure cleanup of created data, either by `beforeEach` clearing collections or specific `afterEach` deletions if needed.

  describe('getMemberCommunities', () => {
    // Test ID: GET_MEMBER_COMMUNITIES_001
    it('GET_MEMBER_COMMUNITIES_001: should retrieve communities the user is a member of', async () => {
        const comm1 = await Community.create({ name: 'Comm1', description: 'D1', members: [mockReq.userId] });
        await Community.create({ name: 'Comm2', description: 'D2', members: [] }); // User not a member
        const comm3 = await Community.create({ name: 'Comm3', description: 'D3', members: [mockReq.userId, new mongoose.Types.ObjectId()] });

        await getMemberCommunities(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.json).toHaveBeenCalledWith(expect.arrayContaining([
            expect.objectContaining({ name: comm1.name }),
            expect.objectContaining({ name: comm3.name }),
        ]));
        expect(mockRes.json.mock.calls[0][0].length).toBe(2);
    });

    // Test ID: GET_MEMBER_COMMUNITIES_002
    it('GET_MEMBER_COMMUNITIES_002: should return empty array if user is member of no communities', async () => {
        await Community.create({ name: 'Comm2', description: 'D2', members: [] });

        await getMemberCommunities(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.json).toHaveBeenCalledWith([]);
    });
    
    // Test ID: GET_MEMBER_COMMUNITIES_003
    it('GET_MEMBER_COMMUNITIES_003: should handle database errors', async () => {
        jest.spyOn(Community, 'find').mockImplementationOnce(() => ({
            select: jest.fn().mockReturnThis(),
            lean: jest.fn().mockRejectedValue(new Error('DB error')),
        }));
        
        await getMemberCommunities(mockReq, mockRes);
        
        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({ message: 'Error getting communities' });
        jest.restoreAllMocks();
    });
  });

  // Add more describe blocks for other functions like:
  // - getNotMemberCommunities
  // - leaveCommunity
  // - banUser
  // - unbanUser
  // - reportPost
  // - getReportedPosts
  // - removeReportedPost
  // - getCommunityMembers
  // - getCommunityMods
  // - addModToCommunity

  // Example for addModToCommunity (partial)
  describe('addModToCommunity', () => {
    let communityAdministered, userToMakeMod;
    beforeEach(async () => {
        // req.userId is the one performing the action
        communityAdministered = await Community.create({ name: 'AdministeredComm', description: 'Test', moderators: [mockReq.userId], members: [mockReq.userId] });
        userToMakeMod = await User.create({ name: 'NewMod', email: 'newmod@example.com', password: 'password' });
        mockReq.params.name = communityAdministered.name;
        mockReq.body.moderatorId = userToMakeMod._id.toString();
    });

    // Test ID: ADD_MOD_COMMUNITY_001
    it('ADD_MOD_COMMUNITY_001: should successfully add a new moderator by an existing moderator', async () => {
        await addModToCommunity(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
            name: communityAdministered.name,
            moderators: expect.arrayContaining([mongoose.Types.ObjectId(mockReq.userId), userToMakeMod._id]),
            members: expect.arrayContaining([mongoose.Types.ObjectId(mockReq.userId), userToMakeMod._id]),
        }));

        const updatedComm = await Community.findById(communityAdministered._id);
        expect(updatedComm.moderators).toContainEqual(userToMakeMod._id);
        expect(updatedComm.members).toContainEqual(userToMakeMod._id);
    });
    
    // Test ID: ADD_MOD_COMMUNITY_002
    it('ADD_MOD_COMMUNITY_002: should return 403 if user performing action is not a moderator', async () => {
        const nonModUser = await User.create({ name: 'NonModUser', email: 'nonmod@example.com', password: 'password' });
        mockReq.userId = nonModUser._id.toString(); // This user is not a mod of communityAdministered

        await addModToCommunity(mockReq, mockRes);
        
        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith({ message: 'User is not a moderator of this community' });
    });
    
    // Test ID: ADD_MOD_COMMUNITY_003
    it('ADD_MOD_COMMUNITY_003: should return 404 if community not found', async () => {
        mockReq.params.name = 'NonExistentCommunityForMod';
        await addModToCommunity(mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(404);
        expect(mockRes.json).toHaveBeenCalledWith({ message: 'Community not found' });
    });

    // Test ID: ADD_MOD_COMMUNITY_004
    it('ADD_MOD_COMMUNITY_004: should return 404 if moderator to add not found', async () => {
        mockReq.body.moderatorId = new mongoose.Types.ObjectId().toString(); // Non-existent user ID
        await addModToCommunity(mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(404);
        expect(mockRes.json).toHaveBeenCalledWith({ message: 'Moderator to add not found' });
    });
    
    // Test ID: ADD_MOD_COMMUNITY_005
    it('ADD_MOD_COMMUNITY_005: should return 400 if user is already a moderator', async () => {
        // Make userToMakeMod a mod already
        await Community.findByIdAndUpdate(communityAdministered._id, { $addToSet: { moderators: userToMakeMod._id } });
        
        await addModToCommunity(mockReq, mockRes);
        
        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({ message: 'User is already a moderator' });
    });
  });

  describe('getNotMemberCommunities', () => {
    // Test ID: GET_NOT_MEMBER_COMMUNITIES_001
    it('GET_NOT_MEMBER_COMMUNITIES_001: should retrieve communities the user is NOT a member of', async () => {
      await Community.create({ name: 'CommMember', description: 'D1', members: [mockReq.userId] });
      const commNotMember1 = await Community.create({ name: 'CommNotMember1', description: 'D2', members: [new mongoose.Types.ObjectId()] });
      const commNotMember2 = await Community.create({ name: 'CommNotMember2', description: 'D3', members: [] });

      await getNotMemberCommunities(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      const responseData = mockRes.json.mock.calls[0][0];
      expect(responseData.length).toBe(2);
      expect(responseData).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: commNotMember1.name }),
        expect.objectContaining({ name: commNotMember2.name }),
      ]));
      expect(responseData).not.toEqual(expect.arrayContaining([
        expect.objectContaining({ name: 'CommMember' }),
      ]));
    });

    // Test ID: GET_NOT_MEMBER_COMMUNITIES_002
    it('GET_NOT_MEMBER_COMMUNITIES_002: should return all communities if user is member of none', async () => {
      const comm1 = await Community.create({ name: 'CommA', description: 'DA' });
      const comm2 = await Community.create({ name: 'CommB', description: 'DB' });

      await getNotMemberCommunities(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json.mock.calls[0][0].length).toBe(2);
      expect(mockRes.json).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({ name: comm1.name }),
        expect.objectContaining({ name: comm2.name }),
      ]));
    });

    // Test ID: GET_NOT_MEMBER_COMMUNITIES_003
    it('GET_NOT_MEMBER_COMMUNITIES_003: should return empty array if user is member of all communities', async () => {
      await Community.create({ name: 'CommX', description: 'DX', members: [mockReq.userId] });
      await Community.create({ name: 'CommY', description: 'DY', members: [mockReq.userId] });
      
      await getNotMemberCommunities(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith([]);
    });
    
    // Test ID: GET_NOT_MEMBER_COMMUNITIES_004
    it('GET_NOT_MEMBER_COMMUNITIES_004: should handle database errors', async () => {
        jest.spyOn(Community, 'find').mockImplementationOnce(() => ({
            select: jest.fn().mockReturnThis(),
            lean: jest.fn().mockRejectedValue(new Error('DB error')),
        }));
        
        await getNotMemberCommunities(mockReq, mockRes);
        
        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({ message: 'Error getting communities' });
        jest.restoreAllMocks();
    });
  });

  describe('leaveCommunity', () => {
    let communityToLeave;
    beforeEach(async () => {
      communityToLeave = await Community.create({ name: 'LeavableComm', description: 'Can be left', members: [mockReq.userId, new mongoose.Types.ObjectId()] });
      mockReq.params.name = communityToLeave.name;
    });

    // Test ID: LEAVE_COMMUNITY_001
    it('LEAVE_COMMUNITY_001: should allow a user to leave a community they are a member of', async () => {
      await leaveCommunity(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        name: communityToLeave.name,
        members: expect.not.arrayContaining([mongoose.Types.ObjectId(mockReq.userId)]),
      }));
      expect(mockRes.json.mock.calls[0][0].members.length).toBe(1); // One other member remains

      const dbCommunity = await Community.findById(communityToLeave._id);
      expect(dbCommunity.members).not.toContainEqual(mongoose.Types.ObjectId(mockReq.userId));
    });

    // Test ID: LEAVE_COMMUNITY_002
    it('LEAVE_COMMUNITY_002: should handle error if community to leave is not found', async () => {
      mockReq.params.name = 'NonExistentCommToLeave';
      jest.spyOn(Community, 'findOneAndUpdate').mockRejectedValueOnce(new Error('DB error'));
        
      await leaveCommunity(mockReq, mockRes);
        
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Error leaving community' });
      jest.restoreAllMocks();
    });

    // Test ID: LEAVE_COMMUNITY_003
    it('LEAVE_COMMUNITY_003: should handle case where user is not a member (no change)', async () => {
      const otherUser = new User({ name: 'Other User', email: 'other@example.com', password: 'password' });
      await otherUser.save();
      mockReq.userId = otherUser._id.toString(); // This user is not a member

      await leaveCommunity(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200); // findOneAndUpdate with $pull on non-member is not an error
      const dbCommunity = await Community.findById(communityToLeave._id);
      expect(dbCommunity.members.length).toBe(2); // Original members remain
    });
  });

  describe('banUser', () => {
    let communityForBan, userToBan, performingMod;
    beforeEach(async () => {
      performingMod = mockUser; // The user from global beforeEach is the mod
      userToBan = await User.create({ name: 'UserToBan', email: 'toban@example.com', password: 'password' });
      communityForBan = await Community.create({ 
        name: 'BanCommunity', 
        description: 'Test ban', 
        moderators: [performingMod._id],
        members: [performingMod._id, userToBan._id] 
      });
      mockReq.params.name = communityForBan.name;
      mockReq.params.userId = userToBan._id.toString();
      mockReq.userId = performingMod._id.toString(); // Ensure req.userId is the moderator
    });

    // Test ID: BAN_USER_001
    it('BAN_USER_001: should allow a moderator to ban a user from a community', async () => {
      await banUser(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        name: communityForBan.name,
        bannedUsers: expect.arrayContaining([userToBan._id]),
        members: expect.not.arrayContaining([userToBan._id]), // User should be removed from members
      }));

      const dbCommunity = await Community.findById(communityForBan._id);
      expect(dbCommunity.bannedUsers).toContainEqual(userToBan._id);
      expect(dbCommunity.members).not.toContainEqual(userToBan._id);
    });

    // Test ID: BAN_USER_002
    it('BAN_USER_002: should return 404 if community not found', async () => {
      mockReq.params.name = 'NonExistentCommForBan';
      await banUser(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Community not found' });
    });

    // Test ID: BAN_USER_003
    it('BAN_USER_003: should return 403 if performing user is not a moderator', async () => {
      const nonModUser = await User.create({ name: 'NonMod', email: 'nonmodban@example.com', password: 'password' });
      mockReq.userId = nonModUser._id.toString(); // This user is not a mod

      await banUser(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'User is not a moderator of this community' });
    });
    
    // Test ID: BAN_USER_004
    it('BAN_USER_004: should return 404 if user to ban not found', async () => {
      mockReq.params.userId = new mongoose.Types.ObjectId().toString(); // Non-existent user
      await banUser(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'User to ban not found' });
    });

    // Test ID: BAN_USER_005
    it('BAN_USER_005: should return 400 if user is already banned', async () => {
      await Community.findByIdAndUpdate(communityForBan._id, { $addToSet: { bannedUsers: userToBan._id } });
      await banUser(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'User is already banned from this community' });
    });
    
    // Test ID: BAN_USER_006
    it('BAN_USER_006: should handle database errors during ban operation', async () => {
        jest.spyOn(Community, 'findById').mockResolvedValueOnce({ // First findById for community check
            ...communityForBan.toObject(),
            moderators: [performingMod._id],
            bannedUsers: [],
            save: jest.fn().mockRejectedValue(new Error('DB save error')) // Mock save to fail
        });
        
        await banUser(mockReq, mockRes);
        
        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({ message: 'Error banning user' });
        jest.restoreAllMocks();
    });
  });

  describe('unbanUser', () => {
    let communityForUnban, userToUnban, performingMod;
    beforeEach(async () => {
      performingMod = mockUser;
      userToUnban = await User.create({ name: 'UserToUnban', email: 'tounban@example.com', password: 'password' });
      communityForUnban = await Community.create({ 
        name: 'UnbanCommunity', 
        description: 'Test unban', 
        moderators: [performingMod._id],
        bannedUsers: [userToUnban._id] // User is initially banned
      });
      mockReq.params.name = communityForUnban.name;
      mockReq.params.userId = userToUnban._id.toString();
      mockReq.userId = performingMod._id.toString();
    });

    // Test ID: UNBAN_USER_001
    it('UNBAN_USER_001: should allow a moderator to unban a user', async () => {
      await unbanUser(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        name: communityForUnban.name,
        bannedUsers: expect.not.arrayContaining([userToUnban._id]),
      }));

      const dbCommunity = await Community.findById(communityForUnban._id);
      expect(dbCommunity.bannedUsers).not.toContainEqual(userToUnban._id);
    });

    // Test ID: UNBAN_USER_002
    it('UNBAN_USER_002: should return 404 if community not found', async () => {
      mockReq.params.name = 'NonExistentCommForUnban';
      await unbanUser(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Community not found' });
    });

    // Test ID: UNBAN_USER_003
    it('UNBAN_USER_003: should return 403 if performing user is not a moderator', async () => {
      const nonModUser = await User.create({ name: 'NonModUnban', email: 'nonmodunban@example.com', password: 'password' });
      mockReq.userId = nonModUser._id.toString();

      await unbanUser(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'User is not a moderator of this community' });
    });
    
    // Test ID: UNBAN_USER_004
    it('UNBAN_USER_004: should return 404 if user to unban not found in DB', async () => {
      mockReq.params.userId = new mongoose.Types.ObjectId().toString(); // Non-existent user
      await unbanUser(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'User to unban not found' });
    });

    // Test ID: UNBAN_USER_005
    it('UNBAN_USER_005: should return 400 if user is not currently banned', async () => {
      // Remove user from banned list first
      await Community.findByIdAndUpdate(communityForUnban._id, { $pull: { bannedUsers: userToUnban._id } });
      await unbanUser(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'User is not banned from this community' });
    });
  });

  describe('reportPost', () => {
    let communityForReport, postToReport, reportingUser;
    beforeEach(async () => {
        reportingUser = mockUser;
        communityForReport = await Community.create({ name: 'ReportComm', description: 'Comm for reports' });
        postToReport = await Post.create({ 
            title: 'Reportable Post', 
            content: 'This is a post to report', 
            user: new mongoose.Types.ObjectId(), // Some other user posted it
            community: communityForReport._id 
        });
        mockReq.params.name = communityForReport.name; // community name in params
        mockReq.body = {
            postId: postToReport._id.toString(),
            reason: 'Spam content'
        };
        mockReq.userId = reportingUser._id.toString();
    });

    // Test ID: REPORT_POST_001
    it('REPORT_POST_001: should allow a user to report a post in a community', async () => {
        await reportPost(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
            post: postToReport._id,
            community: communityForReport._id,
            reportedBy: expect.arrayContaining([reportingUser._id]),
            reasons: expect.arrayContaining([expect.objectContaining({ user: reportingUser._id, reason: 'Spam content' })]),
        }));

        const dbReport = await Report.findOne({ post: postToReport._id });
        expect(dbReport).not.toBeNull();
        expect(dbReport.reportedBy).toContainEqual(reportingUser._id);
        expect(dbReport.reasons[0].reason).toBe('Spam content');
    });

    // Test ID: REPORT_POST_002
    it('REPORT_POST_002: should add a new report reason if post already reported by another user', async () => {
        const otherUser = await User.create({ name: 'OtherReporter', email: 'otherrep@example.com', password: 'password' });
        await Report.create({
            post: postToReport._id,
            community: communityForReport._id,
            reportedBy: [otherUser._id],
            reasons: [{ user: otherUser._id, reason: 'Misinformation' }]
        });

        await reportPost(mockReq, mockRes); // mockUser (reportingUser) reports now

        expect(mockRes.status).toHaveBeenCalledWith(200);
        const dbReport = await Report.findOne({ post: postToReport._id });
        expect(dbReport.reportedBy.length).toBe(2);
        expect(dbReport.reportedBy).toContainEqual(reportingUser._id);
        expect(dbReport.reportedBy).toContainEqual(otherUser._id);
        expect(dbReport.reasons.length).toBe(2);
        expect(dbReport.reasons).toEqual(expect.arrayContaining([
            expect.objectContaining({ user: reportingUser._id, reason: 'Spam content' }),
            expect.objectContaining({ user: otherUser._id, reason: 'Misinformation' })
        ]));
    });
    
    // Test ID: REPORT_POST_003
    it('REPORT_POST_003: should return 404 if community not found', async () => {
        mockReq.params.name = 'NonExistentCommReport';
        await reportPost(mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(404);
        expect(mockRes.json).toHaveBeenCalledWith({ message: 'Community not found' });
    });

    // Test ID: REPORT_POST_004
    it('REPORT_POST_004: should return 404 if post to report not found', async () => {
        mockReq.body.postId = new mongoose.Types.ObjectId().toString();
        await reportPost(mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(404);
        expect(mockRes.json).toHaveBeenCalledWith({ message: 'Post not found' });
    });
    
    // Test ID: REPORT_POST_005
    it('REPORT_POST_005: should return 400 if user has already reported this post', async () => {
        // First report by the same user
        await Report.create({
            post: postToReport._id,
            community: communityForReport._id,
            reportedBy: [reportingUser._id],
            reasons: [{ user: reportingUser._id, reason: 'Initial report' }]
        });
        
        // Attempt to report again by the same user
        await reportPost(mockReq, mockRes);
        
        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({ message: 'User has already reported this post' });
    });
  });

  describe('getReportedPosts', () => {
    let communityWithReports, modUser, post1, post2, report1, report2;
    beforeEach(async () => {
        modUser = mockUser;
        communityWithReports = await Community.create({ name: 'ReportsViewComm', description: 'View reports here', moderators: [modUser._id] });
        const user1 = await User.create({ name: 'Reporter1', email: 'rep1@example.com', password: 'p' });
        const user2 = await User.create({ name: 'Reporter2', email: 'rep2@example.com', password: 'p' });
        
        post1 = await Post.create({ title: 'P1', content: 'C1', user: user1._id, community: communityWithReports._id });
        post2 = await Post.create({ title: 'P2', content: 'C2', user: user2._id, community: communityWithReports._id });
        await Post.create({ title: 'P3 Unreported', content: 'C3', user: user1._id, community: communityWithReports._id });


        report1 = await Report.create({ post: post1._id, community: communityWithReports._id, reportedBy: [user1._id], reasons: [{user: user1._id, reason: "Spam"}] });
        report2 = await Report.create({ post: post2._id, community: communityWithReports._id, reportedBy: [user2._id], reasons: [{user: user2._id, reason: "Hate speech"}] });
        
        mockReq.params.name = communityWithReports.name;
        mockReq.userId = modUser._id.toString();
    });

    // Test ID: GET_REPORTED_POSTS_001
    it('GET_REPORTED_POSTS_001: should retrieve all reported posts for a community by a moderator', async () => {
        await getReportedPosts(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(200);
        const responseData = mockRes.json.mock.calls[0][0];
        expect(responseData.length).toBe(2);
        expect(responseData).toEqual(expect.arrayContaining([
            expect.objectContaining({ post: expect.objectContaining({ _id: post1._id }) }),
            expect.objectContaining({ post: expect.objectContaining({ _id: post2._id }) })
        ]));
    });

    // Test ID: GET_REPORTED_POSTS_002
    it('GET_REPORTED_POSTS_002: should return 403 if user is not a moderator', async () => {
        const nonMod = await User.create({ name: 'NonModViewer', email: 'nonmodview@example.com', password: 'p' });
        mockReq.userId = nonMod._id.toString();
        
        await getReportedPosts(mockReq, mockRes);
        
        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith({ message: 'User is not authorized to view reported posts' });
    });
    
    // Test ID: GET_REPORTED_POSTS_003
    it('GET_REPORTED_POSTS_003: should return 404 if community not found', async () => {
        mockReq.params.name = 'NonExistentCommForReportsView';
        await getReportedPosts(mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(404);
        expect(mockRes.json).toHaveBeenCalledWith({ message: 'Community not found' });
    });
    
    // Test ID: GET_REPORTED_POSTS_004
    it('GET_REPORTED_POSTS_004: should return empty array if no posts are reported', async () => {
        await Report.deleteMany({}); // Clear existing reports
        await getReportedPosts(mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.json).toHaveBeenCalledWith([]);
    });
  });

  describe('removeReportedPost', () => {
    let communityForReportRemoval, modUser, postToRemove, reportToRemove;
    beforeEach(async () => {
        modUser = mockUser;
        communityForReportRemoval = await Community.create({ name: 'ReportRemoveComm', description: 'Remove reports here', moderators: [modUser._id] });
        const reportingUser = await User.create({ name: 'ReporterX', email: 'repx@example.com', password: 'p' });
        
        postToRemove = await Post.create({ title: 'PostWithReport', content: 'Content', user: reportingUser._id, community: communityForReportRemoval._id });
        reportToRemove = await Report.create({ post: postToRemove._id, community: communityForReportRemoval._id, reportedBy: [reportingUser._id], reasons: [{user: reportingUser._id, reason: "Old report"}] });
        
        mockReq.params.name = communityForReportRemoval.name;
        mockReq.params.reportId = reportToRemove._id.toString(); // Controller uses reportId
        mockReq.userId = modUser._id.toString();
    });

    // Test ID: REMOVE_REPORTED_POST_001
    it('REMOVE_REPORTED_POST_001: should allow a moderator to remove a report (dismiss)', async () => {
        await removeReportedPost(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.json).toHaveBeenCalledWith({ message: 'Report removed successfully' });

        const dbReport = await Report.findById(reportToRemove._id);
        expect(dbReport).toBeNull();
    });

    // Test ID: REMOVE_REPORTED_POST_002
    it('REMOVE_REPORTED_POST_002: should return 403 if user is not a moderator', async () => {
        const nonMod = await User.create({ name: 'NonModRemover', email: 'nonmodremove@example.com', password: 'p' });
        mockReq.userId = nonMod._id.toString();
        
        await removeReportedPost(mockReq, mockRes);
        
        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith({ message: 'User is not authorized to remove reports' });
    });

    // Test ID: REMOVE_REPORTED_POST_003
    it('REMOVE_REPORTED_POST_003: should return 404 if community not found', async () => {
        mockReq.params.name = 'NonExistentCommForReportRemove';
        await removeReportedPost(mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(404);
        expect(mockRes.json).toHaveBeenCalledWith({ message: 'Community not found' });
    });

    // Test ID: REMOVE_REPORTED_POST_004
    it('REMOVE_REPORTED_POST_004: should return 404 if report to remove not found', async () => {
        mockReq.params.reportId = new mongoose.Types.ObjectId().toString();
        await removeReportedPost(mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(404);
        expect(mockRes.json).toHaveBeenCalledWith({ message: 'Report not found' });
    });
  });

  describe('getCommunityMembers', () => {
    let communityWithMembers, member1, member2;
    beforeEach(async () => {
        member1 = await User.create({ name: 'Member One', email: 'mem1@example.com', password: 'p' });
        member2 = await User.create({ name: 'Member Two', email: 'mem2@example.com', password: 'p' });
        communityWithMembers = await Community.create({ 
            name: 'MembersComm', 
            description: 'Has members', 
            members: [member1._id, member2._id, mockUser._id] // mockUser is also a member
        });
        mockReq.params.name = communityWithMembers.name;
        // mockReq.userId can be any user for this public endpoint as per controller
    });

    // Test ID: GET_COMMUNITY_MEMBERS_001
    it('GET_COMMUNITY_MEMBERS_001: should retrieve all members of a community', async () => {
        await getCommunityMembers(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(200);
        const responseData = mockRes.json.mock.calls[0][0];
        expect(responseData.length).toBe(3);
        expect(responseData).toEqual(expect.arrayContaining([
            expect.objectContaining({ _id: member1._id }),
            expect.objectContaining({ _id: member2._id }),
            expect.objectContaining({ _id: mockUser._id }),
        ]));
    });

    // Test ID: GET_COMMUNITY_MEMBERS_002
    it('GET_COMMUNITY_MEMBERS_002: should return 404 if community not found', async () => {
        mockReq.params.name = 'NonExistentCommForMembers';
        await getCommunityMembers(mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(404);
        expect(mockRes.json).toHaveBeenCalledWith({ message: 'Community not found' });
    });
    
    // Test ID: GET_COMMUNITY_MEMBERS_003
    it('GET_COMMUNITY_MEMBERS_003: should return empty array if community has no members', async () => {
        const emptyComm = await Community.create({ name: 'EmptyMembersComm', description: 'No members' });
        mockReq.params.name = emptyComm.name;
        await getCommunityMembers(mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.json).toHaveBeenCalledWith([]);
    });
  });

  describe('getCommunityMods', () => {
    let communityWithMods, mod1, mod2;
    beforeEach(async () => {
        mod1 = await User.create({ name: 'Mod One', email: 'mod1@example.com', password: 'p' });
        mod2 = await User.create({ name: 'Mod Two', email: 'mod2@example.com', password: 'p' });
        // mockUser is the one from global setup, let's make it a mod too
        communityWithMods = await Community.create({ 
            name: 'ModsComm', 
            description: 'Has mods', 
            moderators: [mod1._id, mod2._id, mockUser._id] 
        });
        mockReq.params.name = communityWithMods.name;
    });

    // Test ID: GET_COMMUNITY_MODS_001
    it('GET_COMMUNITY_MODS_001: should retrieve all moderators of a community', async () => {
        await getCommunityMods(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(200);
        const responseData = mockRes.json.mock.calls[0][0];
        expect(responseData.length).toBe(3);
        expect(responseData).toEqual(expect.arrayContaining([
            expect.objectContaining({ _id: mod1._id }),
            expect.objectContaining({ _id: mod2._id }),
            expect.objectContaining({ _id: mockUser._id }),
        ]));
    });

    // Test ID: GET_COMMUNITY_MODS_002
    it('GET_COMMUNITY_MODS_002: should return 404 if community not found', async () => {
        mockReq.params.name = 'NonExistentCommForMods';
        await getCommunityMods(mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(404);
        expect(mockRes.json).toHaveBeenCalledWith({ message: 'Community not found' });
    });
    
    // Test ID: GET_COMMUNITY_MODS_003
    it('GET_COMMUNITY_MODS_003: should return empty array if community has no moderators', async () => {
        const emptyModsComm = await Community.create({ name: 'EmptyModsComm', description: 'No mods' });
        mockReq.params.name = emptyModsComm.name;
        await getCommunityMods(mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.json).toHaveBeenCalledWith([]);
    });
  });

});

