const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const search = require('../controllers/search.controller');
const Community = require('../models/community.model');
const User = require('../models/user.model');
const Post = require('../models/post.model');

let mongoServer;

describe('Search Controller', () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    // Xóa các index cũ trước khi tạo mới
    await User.collection.dropIndexes();
    await Community.collection.dropIndexes();
    await Post.collection.dropIndexes();

    // Tạo text indexes cho search
    await User.collection.createIndex({ name: 'text' });
    await Community.collection.createIndex({ name: 'text', description: 'text' });
    await Post.collection.createIndex({ content: 'text' });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await Community.deleteMany({});
    await User.deleteMany({});
    await Post.deleteMany({});
  });

  const mockUserId = new mongoose.Types.ObjectId();
  const mockCommunityId = new mongoose.Types.ObjectId();

  const mockData = {
    user: {
      _id: mockUserId,
      name: 'nam',
      email: 'nam2307nguyen@gmail.com',
      avatar: 'avatar.jpg',
      password: '123456' // Added required password field
    },
    community: {
      _id: mockCommunityId,
      name: 'Test Community',
      description: 'A test community',
      banner: 'banner.jpg',
      members: [mockUserId]
    },
    post: {
      _id: new mongoose.Types.ObjectId(),
      content: 'This is a test post content that is longer than thirty characters',
      user: mockUserId,
      community: mockCommunityId
    }
  };

  test('nên trả về kết quả tìm kiếm phù hợp', async () => {
    // Tạo dữ liệu test
    await User.create(mockData.user);
    await Community.create(mockData.community);
    await Post.create(mockData.post);

    const req = {
      query: { q: 'test' },
      userId: mockUserId.toString()
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    await search(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      users: expect.any(Array),
      posts: expect.arrayContaining([
        expect.objectContaining({
          content: expect.stringContaining('This is a test post content th'),
          user: expect.objectContaining({
            name: mockData.user.name,
            avatar: mockData.user.avatar
          }),
          community: expect.objectContaining({
            name: mockData.community.name
          })
        })
      ]),
      joinedCommunity: expect.objectContaining({
        name: mockData.community.name,
        description: mockData.community.description,
        banner: mockData.community.banner
      })
    }));
  });

  test('nên cắt ngắn nội dung bài viết dài hơn 30 ký tự', async () => {
    await User.create(mockData.user);
    await Community.create(mockData.community);
    await Post.create(mockData.post);

    const req = {
      query: { q: 'test' },
      userId: mockUserId.toString()
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    await search(req, res);

    const response = res.json.mock.calls[0][0];
    expect(response.posts[0].content).toBe('This is a test post content th...');
  });

  test('nên trả về mảng rỗng khi không tìm thấy kết quả', async () => {
    const req = {
      query: { q: 'nonexistent' },
      userId: mockUserId.toString()
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    await search(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      posts: [],
      users: [],
      community: null,
      joinedCommunity: null
    });
  });

  test('nên xử lý lỗi một cách phù hợp', async () => {
    const req = {
      query: { q: 'test' },
      userId: 'invalid-id'
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    await search(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: 'An error occurred'
    });
  });
});