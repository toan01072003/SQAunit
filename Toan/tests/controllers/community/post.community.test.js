const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Community = require('../../../models/community.model');
const User = require('../../../models/user.model');
const Post = require('../../../models/post.model');
const Report = require('../../../models/report.model');

const {
  reportPost,
  getReportedPosts,
  removeReportedPost,
} = require('../../../controllers/community.controller');

let mongoServer;
let mockUser;
let authorUser;
let otherUser;

const printState = async (testId, label) => {
  const posts = await Post.find();
  const reports = await Report.find();
  console.log(`[${testId}] ${label} Posts:`, posts.map(p => p.title));
  console.log(`[${testId}] ${label} Reports:`, reports.map(r => `${r.post} -> ${r.reason}`));
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
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }

  mockUser = new User({ name: 'Test User', email: 'test@example.com', password: 'password' });
  await mockUser.save();

  authorUser = new User({ name: 'Author User', email: 'author@example.com', password: 'password' });
  await authorUser.save();

  otherUser = new User({ name: 'Other User', email: 'other@example.com', password: 'password' });
  await otherUser.save();
});

describe('Community Post Moderation Tests (Community Controller)', () => {
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


  describe('reportPost', () => {
    let community, postToReport;
    beforeEach(async () => {
        community = await Community.create({ name: 'ReportComm', description: 'Community for reports', members: [mockUser._id, authorUser._id] });
        postToReport = await Post.create({ 
          title: 'Reportable Post', 
          content: 'This is content.', 
          author: authorUser._id, 
          user: authorUser._id, // Add user field
          community: community._id 
        });
        mockReq.params.name = community.name;
        mockReq.params.postId = postToReport._id.toString();
        mockReq.body.reason = 'Spam content';
    });

    // Test ID: REPORT_POST_001
    it('REPORT_POST_001: should allow a user to report a post', async () => {
        await reportPost(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(201);
        expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
            post: postToReport._id,
            community: community._id,
            reported_by: mockUser._id,
            reason: 'Spam content'
        }));

        const reportInDb = await Report.findOne({ post: postToReport._id, reported_by: mockUser._id });
        expect(reportInDb).not.toBeNull();
        expect(reportInDb.reason).toBe('Spam content');
    });

    // Test ID: REPORT_POST_002
    it('REPORT_POST_002: should return 404 if community not found', async () => {
        mockReq.params.name = 'NonExistentCommReport';
        await reportPost(mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(404);
        expect(mockRes.json).toHaveBeenCalledWith({ message: 'Community not found' });
    });
    
    // Test ID: REPORT_POST_003
    it('REPORT_POST_003: should return 404 if post not found', async () => {
        mockReq.params.postId = new mongoose.Types.ObjectId().toString();
        await reportPost(mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(404);
        expect(mockRes.json).toHaveBeenCalledWith({ message: 'Post not found' });
    });

    // Test ID: REPORT_POST_004
    it('REPORT_POST_004: should return 400 if user has already reported the post', async () => {
        await Report.create({ post: postToReport._id, community: community._id, reported_by: mockUser._id, reason: 'Previous report' });
        await reportPost(mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({ message: 'You have already reported this post' });
    });
  });


 describe('getReportedPosts', () => {
    let communityWithReports, post1, post2;
    beforeEach(async () => {
        // mockUser is the moderator
        communityWithReports = await Community.create({ name: 'ModReportComm', description: 'Community for mod reports', moderators: [mockUser._id] });
        post1 = await Post.create({ title: 'Reported Post 1', content: 'Content 1', author: authorUser._id, community: communityWithReports._id });
        post2 = await Post.create({ title: 'Reported Post 2', content: 'Content 2', author: authorUser._id, community: communityWithReports._id });
        await Post.create({ title: 'Clean Post', content: 'Content 3', author: authorUser._id, community: communityWithReports._id }); // Not reported

        await Report.create({ post: post1._id, community: communityWithReports._id, reported_by: otherUser._id, reason: 'Reason 1' });
        await Report.create({ post: post1._id, community: communityWithReports._id, reported_by: authorUser._id, reason: 'Reason 1.2' }); // Multiple reports for post1
        await Report.create({ post: post2._id, community: communityWithReports._id, reported_by: otherUser._id, reason: 'Reason 2' });
        
        mockReq.params.name = communityWithReports.name;
    });

    // Test ID: GET_REPORTS_001
    it('GET_REPORTS_001: should get all reported posts in a community for a moderator', async () => {
        await getReportedPosts(mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(200);
        const reportedPosts = mockRes.json.mock.calls[0][0];
        expect(reportedPosts.length).toBe(2); // Two distinct posts reported
        
        const p1Reports = reportedPosts.find(p => p.post._id.toString() === post1._id.toString());
        const p2Reports = reportedPosts.find(p => p.post._id.toString() === post2._id.toString());

        expect(p1Reports).toBeDefined();
        expect(p1Reports.reports.length).toBe(2);
        expect(p1Reports.post.title).toBe('Reported Post 1');

        expect(p2Reports).toBeDefined();
        expect(p2Reports.reports.length).toBe(1);
        expect(p2Reports.post.title).toBe('Reported Post 2');
    });
    
    // Test ID: GET_REPORTS_002
    it('GET_REPORTS_002: should return 403 if user is not a moderator', async () => {
        const nonModUser = await User.create({name: "NonModGetter", email: "nonmodget@example.com", password: "password"});
        mockReq.userId = nonModUser._id.toString();
        await getReportedPosts(mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith({ message: 'User is not a moderator of this community' });
    });
    // Add more tests: community not found, no reported posts
  }); 
    it('GET_REPORTS_003: should return 404 if community not found', async () => {
      mockReq.params.name = 'NonExistingCommunity';
      await printState('GET_REPORTS_003', '🟡 BEFORE');
      await getReportedPosts(mockReq, mockRes);
      await printState('GET_REPORTS_003', '🟢 AFTER');

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Community not found' });
    });

    it('GET_REPORTS_004: should return empty array if no reported posts', async () => {
      const comm = await Community.create({ name: 'NoReportsComm', description: 'Community with no reports', moderators: [mockReq.userId] });
      mockReq.params.name = comm.name;
      await Post.create({ title: 'Clean Post', content: 'Nothing wrong', author: authorUser._id, community: comm._id });
      await printState('GET_REPORTS_004', '🟡 BEFORE');
      await getReportedPosts(mockReq, mockRes);
      await printState('GET_REPORTS_004', '🟢 AFTER');

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith([]);
    });
  });

  describe('getReportedPosts', () => { // This describe block appears to be a duplicate
    let communityWithReports, post1, post2;
    beforeEach(async () => {
        // mockUser is the moderator
        communityWithReports = await Community.create({ name: 'ModReportComm', description: 'Community for mod reports (in duplicate block)', moderators: [mockUser._id] });
        post1 = await Post.create({ title: 'Reported Post 1', content: 'Content 1', author: authorUser._id, community: communityWithReports._id });
        post2 = await Post.create({ title: 'Reported Post 2', content: 'Content 2', author: authorUser._id, community: communityWithReports._id });
        await Post.create({ title: 'Clean Post', content: 'Content 3', author: authorUser._id, community: communityWithReports._id }); // Not reported

        await Report.create({ post: post1._id, community: communityWithReports._id, reported_by: otherUser._id, reason: 'Reason 1' });
        await Report.create({ post: post1._id, community: communityWithReports._id, reported_by: authorUser._id, reason: 'Reason 1.2' }); // Multiple reports for post1
        await Report.create({ post: post2._id, community: communityWithReports._id, reported_by: otherUser._id, reason: 'Reason 2' });
        
        mockReq.params.name = communityWithReports.name;
    });

    // Test ID: GET_REPORTS_001
    it('GET_REPORTS_001: should get all reported posts in a community for a moderator', async () => {
        await getReportedPosts(mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(200);
        const reportedPosts = mockRes.json.mock.calls[0][0];
        expect(reportedPosts.length).toBe(2); // Two distinct posts reported
        
        const p1Reports = reportedPosts.find(p => p.post._id.toString() === post1._id.toString());
        const p2Reports = reportedPosts.find(p => p.post._id.toString() === post2._id.toString());

        expect(p1Reports).toBeDefined();
        expect(p1Reports.reports.length).toBe(2);
        expect(p1Reports.post.title).toBe('Reported Post 1');

        expect(p2Reports).toBeDefined();
        expect(p2Reports.reports.length).toBe(1);
        expect(p2Reports.post.title).toBe('Reported Post 2');
    });
    
    // Test ID: GET_REPORTS_002
    it('GET_REPORTS_002: should return 403 if user is not a moderator', async () => {
        const nonModUser = await User.create({name: "NonModGetter", email: "nonmodget@example.com", password: "password"});
        mockReq.userId = nonModUser._id.toString();
        await getReportedPosts(mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith({ message: 'User is not a moderator of this community' });
    });
    // Add more tests: community not found, no reported posts

  
    it('GET_REPORTS_003: should return 404 if community not found', async () => {
      mockReq.params.name = 'NonExistingCommunity';
      await printState('GET_REPORTS_003', '🟡 BEFORE');
      await getReportedPosts(mockReq, mockRes);
      await printState('GET_REPORTS_003', '🟢 AFTER');

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Community not found' });
    });

    it('GET_REPORTS_004: should return empty array if no reported posts', async () => {
      const comm = await Community.create({ name: 'NoReportsComm', description: 'Community with no reports', moderators: [mockReq.userId] });
      mockReq.params.name = comm.name;
      await Post.create({ title: 'Clean Post', content: 'Nothing wrong', author: authorUser._id, community: comm._id });
      await printState('GET_REPORTS_004', '🟡 BEFORE');
      await getReportedPosts(mockReq, mockRes);
      await printState('GET_REPORTS_004', '🟢 AFTER');

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith([]);
    });
  });

  // Fix the structure - move these tests inside the getReportedPosts describe block
  it('GET_REPORTS_003: should return 404 if community not found', async () => {
    mockReq.params.name = 'NonExistingCommunity';
    await printState('GET_REPORTS_003', '🟡 BEFORE');
    await getReportedPosts(mockReq, mockRes);
    await printState('GET_REPORTS_003', '🟢 AFTER');

    expect(mockRes.status).toHaveBeenCalledWith(404);
    expect(mockRes.json).toHaveBeenCalledWith({ message: 'Community not found' });
  });

  it('GET_REPORTS_004: should return empty array if no reported posts', async () => {
    const comm = await Community.create({ name: 'NoReportsComm', description: 'Community with no reports', moderators: [mockReq.userId] });
    mockReq.params.name = comm.name;
    await Post.create({ 
      title: 'Clean Post', 
      content: 'Nothing wrong', 
      author: authorUser._id, 
      user: authorUser._id, // Add user field
      community: comm._id 
    });
    await printState('GET_REPORTS_004', '🟡 BEFORE');
    await getReportedPosts(mockReq, mockRes);
    await printState('GET_REPORTS_004', '🟢 AFTER');

    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith([]);
  });

  // Remove this duplicate describe block and move the removeReportedPost tests to their own describe block
  describe('removeReportedPost', () => {
    let communityForRemoval, postToRemove;
    beforeEach(async () => {
        communityForRemoval = await Community.create({ name: 'RemovePostComm', description: 'Community for post removal tests', moderators: [mockReq.userId] });
        postToRemove = await Post.create({ 
          title: 'Post To Remove', 
          content: 'Bad content', 
          author: authorUser._id, 
          user: authorUser._id, // Add user field
          community: communityForRemoval._id 
        });
        await Report.create({ post: postToRemove._id, community: communityForRemoval._id, reported_by: otherUser._id, reason: 'Violation' });

        mockReq.params.name = communityForRemoval.name;
        mockReq.params.postId = postToRemove._id.toString();
    });

    // Test ID: REMOVE_REPORT_POST_001
    it('REMOVE_REPORT_POST_001: should allow a moderator to remove a reported post and its reports', async () => {
        await removeReportedPost(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.json).toHaveBeenCalledWith({ message: 'Post and its reports removed successfully' });

        const dbPost = await Post.findById(postToRemove._id);
        expect(dbPost).toBeNull();
        const dbReports = await Report.find({ post: postToRemove._id });
        expect(dbReports.length).toBe(0);
    });

    it('REMOVE_REPORT_POST_002: should return 403 if user is not a moderator', async () => {
      const nonModUser = await User.create({ name: 'NotMod', email: 'notmod@example.com', password: 'password' });
      mockReq.userId = nonModUser._id.toString();

      const community = await Community.create({ name: 'NoModComm', description: 'Community for no mod test' });
      const post = await Post.create({ 
        title: 'Some Post', 
        content: 'X', 
        author: authorUser._id, 
        user: authorUser._id, // Add user field
        community: community._id 
      });
      mockReq.params.name = community.name;
      mockReq.params.postId = post._id.toString();

      await printState('REMOVE_REPORT_POST_002', '🟡 BEFORE');
      await removeReportedPost(mockReq, mockRes);
      await printState('REMOVE_REPORT_POST_002', '🟢 AFTER');

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'User is not a moderator of this community' });
    });

    it('REMOVE_REPORT_POST_003: should return 404 if community not found', async () => {
      mockReq.params.name = 'InvalidCommunity';
      mockReq.params.postId = new mongoose.Types.ObjectId().toString();
      await printState('REMOVE_REPORT_POST_003', '🟡 BEFORE');
      await removeReportedPost(mockReq, mockRes);
      await printState('REMOVE_REPORT_POST_003', '🟢 AFTER');
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Community not found' });
    });

    it('REMOVE_REPORT_POST_004: should return 404 if post not found', async () => {
      const community = await Community.create({ name: 'PostlessComm', description: 'Community for postless test', moderators: [mockReq.userId] });
      mockReq.params.name = community.name;
      mockReq.params.postId = new mongoose.Types.ObjectId().toString();

      await printState('REMOVE_REPORT_POST_004', '🟡 BEFORE');
      await removeReportedPost(mockReq, mockRes);
      await printState('REMOVE_REPORT_POST_004', '🟢 AFTER');

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Post not found' });
    });

    it('REMOVE_REPORT_POST_005: should handle unreported post deletion gracefully (post exists but not reported)', async () => {
      const community = await Community.create({ name: 'UnreportedComm', description: 'Community for unreported post test', moderators: [mockReq.userId] });
      const post = await Post.create({ 
        title: 'Unreported', 
        content: 'No issues', 
        author: authorUser._id, 
        user: authorUser._id, // Add user field
        community: community._id 
      });
      mockReq.params.name = community.name;
      mockReq.params.postId = post._id.toString();

      await printState('REMOVE_REPORT_POST_005', '🟡 BEFORE');
      await removeReportedPost(mockReq, mockRes);
      await printState('REMOVE_REPORT_POST_005', '🟢 AFTER');

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Post and its reports removed successfully' });

      const dbPost = await Post.findById(post._id);
      expect(dbPost).toBeNull();
    });
  });

