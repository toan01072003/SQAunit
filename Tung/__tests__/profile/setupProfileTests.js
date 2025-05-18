const User = require('../../server/models/user.model');
const Relationship = require('../../server/models/relationship.model');
const Post = require('../../server/models/post.model');

// Mock mongoose to avoid actual database connections
jest.mock('mongoose', () => ({
  Schema: jest.fn(),
  model: jest.fn(),
  connect: jest.fn(),
  disconnect: jest.fn()
}));

User.create = jest.fn();
User.findById = jest.fn();
User.findByIdAndUpdate = jest.fn();
User.deleteMany = jest.fn();

Relationship.create = jest.fn();
Relationship.findOne = jest.fn();
Relationship.deleteOne = jest.fn();
Relationship.deleteMany = jest.fn();

Post.deleteMany = jest.fn();

const mockUsers = {
  user1: {
    _id: 'user1-id',
    name: 'User One',
    email: 'user1@example.com',
    avatar: 'https://example.com/avatar1.jpg',
    location: 'New York',
    bio: 'Test bio for user 1',
    interests: 'coding,testing'
  },
  user2: {
    _id: 'user2-id',
    name: 'User Two',
    email: 'user2@example.com',
    avatar: 'https://example.com/avatar2.jpg',
    location: 'San Francisco',
    bio: 'Test bio for user 2',
    interests: 'reading,writing'
  }
};

beforeEach(() => {
  jest.clearAllMocks();
});

module.exports = {
  User,
  Relationship,
  Post,
  mockUsers
};
