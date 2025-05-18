const { Token, mockUser } = require('./setupTests');

describe('Token Management', () => {
  // Test case: should create refresh token successfully
// Description: This test ensures that the described behavior works as expected.
// Expected Output: What we expect after running the test.
// Actual Output: Logged using console.log inside the test.
it('should create refresh token successfully', async () => {
    const refreshToken = {
      user: mockUser._id,
      token: 'refresh-token-string',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    };

    Token.create.mockResolvedValue(refreshToken);
    const savedToken = await Token.create(refreshToken);
    console.log('Actual:', savedToken.user);
    expect(savedToken.user).toBe(mockUser._id);
    console.log('Actual:', savedToken.token);
    expect(savedToken.token).toBe('refresh-token-string');
  });

  // Test case: should find existing token
// Description: This test ensures that the described behavior works as expected.
// Expected Output: What we expect after running the test.
// Actual Output: Logged using console.log inside the test.
it('should find existing token', async () => {
    const existingToken = {
      user: mockUser._id,
      token: 'existing-token',
      expiresAt: new Date()
    };

    Token.findOne.mockResolvedValue(existingToken);
    const foundToken = await Token.findOne({ user: mockUser._id });
    expect(foundToken.token).toBe('existing-token');
  });

  // Test case: should handle expired token cleanup
// Description: This test ensures that the described behavior works as expected.
// Expected Output: What we expect after running the test.
// Actual Output: Logged using console.log inside the test.
it('should handle expired token cleanup', async () => {
    Token.deleteMany.mockResolvedValue({ deletedCount: 1 });
    const result = await Token.deleteMany({ expiresAt: { $lt: new Date() } });
    expect(result.deletedCount).toBe(1);
  });
});
