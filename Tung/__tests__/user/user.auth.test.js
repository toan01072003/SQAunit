const { bcrypt, jwt, mockUser } = require('./setupTests');

describe('User Authentication', () => {
  // Test case: should verify correct password
// Description: This test ensures that the described behavior works as expected.
// Expected Output: What we expect after running the test.
// Actual Output: Logged using console.log inside the test.
it('should verify correct password', async () => {
    const hashedPassword = await bcrypt.hash(mockUser.password, 10);
    const isMatch = await bcrypt.compare(mockUser.password, hashedPassword);
    console.log('Actual:', isMatch);
    expect(isMatch).toBe(true);
  });

  // Test case: should generate and verify JWT token
// Description: This test ensures that the described behavior works as expected.
// Expected Output: What we expect after running the test.
// Actual Output: Logged using console.log inside the test.
it('should generate and verify JWT token', async () => {
    const payload = { id: mockUser._id, email: mockUser.email };
    const token = jwt.sign(payload, 'test-secret', { expiresIn: '1h' });
    const decoded = jwt.verify(token, 'test-secret');
    expect(decoded.email).toBe(mockUser.email);
    expect(decoded).toHaveProperty('exp');
  });

  it('should reject invalid JWT token', () => {
    const invalidToken = 'invalid.token.string';
    expect(() => {
      jwt.verify(invalidToken, 'test-secret');
    }).toThrow(jwt.JsonWebTokenError);
  });

  it('should handle expired tokens correctly', () => {
    const payload = { id: mockUser._id, email: mockUser.email };
    const token = jwt.sign(payload, 'test-secret', { expiresIn: '0s' });
    expect(() => {
      jwt.verify(token, 'test-secret');
    }).toThrow(jwt.TokenExpiredError);
  });
});
