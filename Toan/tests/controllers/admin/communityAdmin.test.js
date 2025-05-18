const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Community = require('../../../models/community.model');
const User = require('../../../models/user.model'); // For populating moderators/members
const Admin = require('../../../models/admin.model');
const bcrypt = require('bcrypt');

const { getCommunities, getCommunity } = require('../../../controllers/admin.controller'); // Renamed from original getCommunity to avoid conflict if other getCommunity exists

let mongoServer;
let adminUser;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  mongoose.set('strictQuery', true); // Or false, depending on your choice
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

  const hashedPassword = await bcrypt.hash('adminpassword', 10);
  adminUser = new Admin({ username: 'testadmincomm', password: hashedPassword });
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
  // Clear User and Community models specifically if needed, beyond general collection clearing
  await User.deleteMany({});
  await Community.deleteMany({});

  const existingAdmin = await Admin.findOne({ username: 'testadmincomm' });
  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash('adminpassword', 10);
    adminUser = new Admin({ _id: adminUser._id, username: 'testadmincomm', password: hashedPassword });
    await adminUser.save();
  }
});

describe('Admin Community Management Tests', () => {
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

  describe('getCommunities (Admin)', () => {
    // Test ID: GET_ADMIN_COMMUNITIES_001
    it('GET_ADMIN_COMMUNITIES_001: should retrieve all communities with selected fields', async () => {
      await Community.insertMany([
        { name: 'Tech World', description: 'Tech discussions', banner: 'tech.jpg' },
        { name: 'Gamers Hub', description: 'Gaming community', banner: 'game.png' },
      ]);
      await getCommunities(mockReq, mockRes); // This is adminController.getCommunities

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({ name: 'Tech World', banner: 'tech.jpg' }),
        expect.objectContaining({ name: 'Gamers Hub', banner: 'game.png' }),
      ]));
      expect(mockRes.json.mock.calls[0][0].length).toBe(2);
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
      await getCommunity(mockReq, mockRes); // This is adminController.getCommunity

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
            populate: jest.fn().mockReturnThis(), // for moderators
            populate: jest.fn().mockRejectedValueOnce(new Error('Database error')) // for members
        }));
        await getCommunity(mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({ message: 'Error retrieving community details' });
        jest.restoreAllMocks();
    });
  });
});