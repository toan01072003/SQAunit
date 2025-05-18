const User = require('../../server/models/user.model');
const Token = require('../../server/models/token.model');
const UserPreference = require('../../server/models/preference.model');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Mock mongoose to avoid actual database connections
jest.mock('mongoose', () => ({
  Schema: jest.fn(),
  model: jest.fn(),
  connect: jest.fn(),
  disconnect: jest.fn()
}));

// Mock User model methods
User.create = jest.fn();
User.findOne = jest.fn();
User.findById = jest.fn();
User.deleteMany = jest.fn();
User.findByIdAndUpdate = jest.fn();

// Mock Token model methods
Token.create = jest.fn();
Token.findOne = jest.fn();
Token.deleteMany = jest.fn();

// Mock UserPreference model methods
UserPreference.create = jest.fn();
UserPreference.findOne = jest.fn();
UserPreference.deleteMany = jest.fn();

const mockUser = {
  _id: 'mock-user-id',
  name: 'Test User',
  email: 'test@example.com',
  password: 'testPassword123',
  avatar: 'https://example.com/avatar.jpg',
  role: 'general'
};

beforeEach(() => {
  jest.clearAllMocks();
});

module.exports = {
  User,
  Token,
  UserPreference,
  bcrypt,
  jwt,
  mockUser
};
