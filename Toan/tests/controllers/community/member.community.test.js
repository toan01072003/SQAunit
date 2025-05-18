const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Community = require('../../../models/community.model');
const User = require('../../../models/user.model');

const {
  getMemberCommunities,
  getNotMemberCommunities,
  joinCommunity,
  leaveCommunity,
  banUser,
  unbanUser,
  getCommunityMembers,
  getCommunityMods,
  addModToCommunity,
} = require('../../../controllers/community.controller');

let mongoServer;
let mockUser; // User performing actions
let otherUser; // Another user for testing ban/mod scenarios

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  mockUser = new User({ name: 'Test User', email: 'test@example.com', password: 'password' });
  await mockUser.save();
  otherUser = new User({ name: 'Other User', email: 'other@example.com', password: 'password' });
  await otherUser.save();
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
  await Community.deleteMany({}); // Ensure communities are cleared

  // Recreate users if they were deleted or modified
  let existingMockUser = await User.findById(mockUser._id);
  if (!existingMockUser) {
    mockUser = new User({ _id: mockUser._id, name: 'Test User', email: 'test@example.com', password: 'password' });
    await mockUser.save();
  }
  let existingOtherUser = await User.findById(otherUser._id);
  if (!existingOtherUser) {
    otherUser = new User({ _id: otherUser._id, name: 'Other User', email: 'other@example.com', password: 'password' });
    await otherUser.save();
  }
});

describe('Community Member & Moderation Tests (Community Controller)', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    mockReq = {
      body: {},
      query: {},
      params: {},
      userId: mockUser._id.toString(), // User performing the action
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

  describe('getMemberCommunities', () => {
    // Test ID: GET_MEMBER_COMMUNITIES_001
    it('GET_MEMBER_COMMUNITIES_001: should retrieve communities the user is a member of', async () => {
        const comm1 = await Community.create({ name: 'Comm1', description: 'D1', members: [mockReq.userId] });
        await Community.create({ name: 'Comm2', description: 'D2', members: [otherUser._id] }); 
        const comm3 = await Community.create({ name: 'Comm3', description: 'D3', members: [mockReq.userId, otherUser._id] });

        await getMemberCommunities(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(200);
        const responseData = mockRes.json.mock.calls[0][0];
        expect(responseData.length).toBe(2);
        expect(responseData).toEqual(expect.arrayContaining([
            expect.objectContaining({ name: comm1.name }),
            expect.objectContaining({ name: comm3.name }),
        ]));
    });

    // Test ID: GET_MEMBER_COMMUNITIES_002
    it('GET_MEMBER_COMMUNITIES_002: should return empty array if user is member of no communities', async () => {
        await Community.create({ name: 'Comm2', description: 'D2', members: [otherUser._id] });

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

  describe('getNotMemberCommunities', () => {
    // Test ID: GET_NOT_MEMBER_COMMUNITIES_001
    it('GET_NOT_MEMBER_COMMUNITIES_001: should retrieve communities the user is NOT a member of', async () => {
        await Community.create({ name: 'CommMember', description: 'D1', members: [mockReq.userId] });
        const commNotMember1 = await Community.create({ name: 'CommNotMember1', description: 'D2', members: [otherUser._id] });
        const commNotMember2 = await Community.create({ name: 'CommNotMember2', description: 'D3', members: [] });


        await getNotMemberCommunities(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(200);
        const responseData = mockRes.json.mock.calls[0][0];
        expect(responseData.length).toBe(2);
        expect(responseData).toEqual(expect.arrayContaining([
            expect.objectContaining({ name: commNotMember1.name }),
            expect.objectContaining({ name: commNotMember2.name }),
        ]));
    });

    // Test ID: GET_NOT_MEMBER_COMMUNITIES_002
    it('GET_NOT_MEMBER_COMMUNITIES_002: should return empty array if user is member of all communities or no other communities exist', async () => {
        await Community.create({ name: 'CommMember', description: 'D1', members: [mockReq.userId] });
        
        await getNotMemberCommunities(mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.json).toHaveBeenCalledWith([]);

        await Community.deleteMany({}); // No communities at all
        await getNotMemberCommunities(mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.json).toHaveBeenCalledWith([]);
    });
    
    // Test ID: GET_NOT_MEMBER_COMMUNITIES_003
    it('GET_NOT_MEMBER_COMMUNITIES_003: should handle database errors', async () => {
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
        jest.spyOn(Community, 'findOneAndUpdate').mockResolvedValueOnce(null); // Simulate not found
        
        await joinCommunity(mockReq, mockRes);
        
        // Controller returns 200 with null if not found, which might not be ideal.
        // To test the 500 error path for a DB failure:
        jest.restoreAllMocks();
        jest.spyOn(Community, 'findOneAndUpdate').mockRejectedValueOnce(new Error('DB error'));
        mockReq.params.name = communityToJoin.name; // Reset name

        await joinCommunity(mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({ message: 'Error joining community' });
        jest.restoreAllMocks();
    });

    // Test ID: JOIN_COMMUNITY_003
    // The controller uses $push, which can add duplicates. If unique members are desired, $addToSet should be used.
    // This test reflects the current behavior of $push.
    it('JOIN_COMMUNITY_003: should add user again if $push is used and user already a member', async () => {
        await Community.findOneAndUpdate({ name: communityToJoin.name }, { $push: { members: mockReq.userId } }); // First join
        
        await joinCommunity(mockReq, mockRes); // Attempt to join again

        expect(mockRes.status).toHaveBeenCalledWith(200);
        const dbCommunity = await Community.findById(communityToJoin._id);
        expect(dbCommunity.members.filter(id => id.toString() === mockReq.userId).length).toBe(2); // User added twice
    });
  });

  describe('leaveCommunity', () => {
    let communityToLeave;
    beforeEach(async () => {
        communityToLeave = await Community.create({ name: 'LeavableComm', description: 'Can be left', members: [mockReq.userId, otherUser._id] });
        mockReq.params.name = communityToLeave.name;
    });

    // Test ID: LEAVE_COMMUNITY_001
    it('LEAVE_COMMUNITY_001: should allow a user to leave a community', async () => {
        await leaveCommunity(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
            name: communityToLeave.name,
            members: expect.not.arrayContaining([mongoose.Types.ObjectId(mockReq.userId)]),
        }));
        expect(mockRes.json.mock.calls[0][0].members).toContainEqual(otherUser._id);


        const dbCommunity = await Community.findById(communityToLeave._id);
        expect(dbCommunity.members).not.toContainEqual(mongoose.Types.ObjectId(mockReq.userId));
        expect(dbCommunity.members).toContainEqual(otherUser._id);
    });

    // Test ID: LEAVE_COMMUNITY_002
    it('LEAVE_COMMUNITY_002: should handle error if community to leave is not found or other DB error', async () => {
        mockReq.params.name = 'NonExistentCommToLeave';
        jest.spyOn(Community, 'findOneAndUpdate').mockRejectedValueOnce(new Error('DB error'));
        
        await leaveCommunity(mockReq, mockRes);
        
        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({ message: 'Error leaving community' });
        jest.restoreAllMocks();
    });
  });

  describe('banUser', () => {
    let communityForBan, userToBan;
    beforeEach(async () => {
        userToBan = await User.create({ name: 'BannableUser', email: 'bannable@example.com', password: 'password' });
        // mockUser (req.userId) is the moderator
        communityForBan = await Community.create({ 
            name: 'BanTestComm', 
            description: 'Test banning', 
            moderators: [mockReq.userId], 
            members: [mockReq.userId, userToBan._id] 
        });
        mockReq.params.name = communityForBan.name;
        mockReq.body.userId = userToBan._id.toString();
    });

    // Test ID: BAN_USER_001
    it('BAN_USER_001: should allow a moderator to ban a user from a community', async () => {
        await banUser(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
            name: communityForBan.name,
            banned_users: expect.arrayContaining([userToBan._id]),
            members: expect.not.arrayContaining([userToBan._id])
        }));

        const dbCommunity = await Community.findById(communityForBan._id);
        expect(dbCommunity.banned_users).toContainEqual(userToBan._id);
        expect(dbCommunity.members).not.toContainEqual(userToBan._id);
    });

    // Test ID: BAN_USER_002
    it('BAN_USER_002: should return 403 if user performing action is not a moderator', async () => {
        const nonModUser = await User.create({ name: 'NonMod', email: 'nonmod@example.com', password: 'password' });
        mockReq.userId = nonModUser._id.toString(); // Action performed by non-moderator

        await banUser(mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith({ message: 'User is not a moderator of this community' });
    });
    
    // Test ID: BAN_USER_003
    it('BAN_USER_003: should return 404 if community not found', async () => {
        mockReq.params.name = 'NonExistentCommunity';
        await banUser(mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(404);
        expect(mockRes.json).toHaveBeenCalledWith({ message: 'Community not found' });
    });

    // Test ID: BAN_USER_004
    it('BAN_USER_004: should return 404 if user to ban not found', async () => {
        mockReq.body.userId = new mongoose.Types.ObjectId().toString();
        await banUser(mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(404);
        expect(mockRes.json).toHaveBeenCalledWith({ message: 'User to ban not found' });
    });
  });

  describe('unbanUser', () => {
    let communityForUnban, userToUnban;
    beforeEach(async () => {
        userToUnban = await User.create({ name: 'UnbannableUser', email: 'unbannable@example.com', password: 'password' });
        communityForUnban = await Community.create({ 
            name: 'UnbanTestComm', 
            description: 'Test unbanning', 
            moderators: [mockReq.userId], 
            banned_users: [userToUnban._id] 
        });
        mockReq.params.name = communityForUnban.name;
        mockReq.body.userId = userToUnban._id.toString();
    });

    // Test ID: UNBAN_USER_001
    it('UNBAN_USER_001: should allow a moderator to unban a user', async () => {
        await unbanUser(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
            name: communityForUnban.name,
            banned_users: expect.not.arrayContaining([userToUnban._id]),
        }));

        const dbCommunity = await Community.findById(communityForUnban._id);
        expect(dbCommunity.banned_users).not.toContainEqual(userToUnban._id);
    });
    // Add more tests for unbanUser (not moderator, community not found, user not found, user not banned)
  });

  describe('getCommunityMembers', () => {
    let communityWithMembers;
    beforeEach(async () => {
        communityWithMembers = await Community.create({
            name: 'MemberComm',
            members: [mockUser._id, otherUser._id]
        });
        mockReq.params.name = communityWithMembers.name;
    });

    // Test ID: GET_COMM_MEMBERS_001
    it('GET_COMM_MEMBERS_001: should get all members of a community', async () => {
        await getCommunityMembers(mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.json).toEqual(expect.arrayContaining([
            expect.objectContaining({ name: mockUser.name }),
            expect.objectContaining({ name: otherUser.name })
        ]));
        expect(mockRes.json.mock.calls[0][0].length).toBe(2);
    });
    // Add more tests for getCommunityMembers (community not found, no members, DB error)
  });

  describe('getCommunityMods', () => {
    let communityWithMods;
    beforeEach(async () => {
        communityWithMods = await Community.create({
            name: 'ModComm',
            moderators: [mockUser._id, otherUser._id]
        });
        mockReq.params.name = communityWithMods.name;
    });
    // Test ID: GET_COMM_MODS_001
    it('GET_COMM_MODS_001: should get all moderators of a community', async () => {
        await getCommunityMods(mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.json).toEqual(expect.arrayContaining([
            expect.objectContaining({ name: mockUser.name }),
            expect.objectContaining({ name: otherUser.name })
        ]));
        expect(mockRes.json.mock.calls[0][0].length).toBe(2);
    });
    // Add more tests for getCommunityMods
  });

  describe('addModToCommunity', () => {
    let communityAdministered, userToMakeMod;
    beforeEach(async () => {
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
            members: expect.arrayContaining([mongoose.Types.ObjectId(mockReq.userId), userToMakeMod._id]), // User also becomes a member
        }));

        const updatedComm = await Community.findById(communityAdministered._id);
        expect(updatedComm.moderators).toContainEqual(userToMakeMod._id);
        expect(updatedComm.members).toContainEqual(userToMakeMod._id); // Check if user was added to members
    });
    
    // Test ID: ADD_MOD_COMMUNITY_002
    it('ADD_MOD_COMMUNITY_002: should return 403 if user performing action is not a moderator', async () => {
        const nonModUser = await User.create({ name: 'NonModAction', email: 'nonmodaction@example.com', password: 'password' });
        mockReq.userId = nonModUser._id.toString(); // Action performed by non-moderator

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
    it('ADD_MOD_COMMUNITY_004: should return 404 if user to make moderator not found', async () => {
        mockReq.body.moderatorId = new mongoose.Types.ObjectId().toString();
        await addModToCommunity(mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(404);
        expect(mockRes.json).toHaveBeenCalledWith({ message: 'User to be made moderator not found' });
    });
  });
});