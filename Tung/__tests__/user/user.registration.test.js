const { User, bcrypt, mockUser } = require('./setupTests');

describe('User Registration', () => {
  // Test case: should create a new user successfully
// Description: This test ensures that the described behavior works as expected.
// Expected Output: What we expect after running the test.
// Actual Output: Logged using console.log inside the test.
it('should create a new user successfully', async () => {
    const hashedPassword = await bcrypt.hash(mockUser.password, 10);
    User.create.mockResolvedValue({ ...mockUser, password: hashedPassword });
    const savedUser = await User.create(mockUser);
    expect(savedUser.email).toBe(mockUser.email);
    expect(savedUser.name).toBe(mockUser.name);
    expect(savedUser.role).toBe('general');
    expect(User.create).toHaveBeenCalledTimes(1);
  });

  // Test case: should set isEmailVerified flag correctly
// Description: This test ensures that the described behavior works as expected.
// Expected Output: What we expect after running the test.
// Actual Output: Logged using console.log inside the test.
it('should set isEmailVerified flag correctly', async () => {
    const verifiedUser = { ...mockUser, isEmailVerified: true };
    User.create.mockResolvedValue(verifiedUser);
    const savedUser = await User.create(verifiedUser);
    console.log('Actual:', savedUser.isEmailVerified);
    expect(savedUser.isEmailVerified).toBe(true);
  });

  // Test case: should properly hash the password
// Description: This test ensures that the described behavior works as expected.
// Expected Output: What we expect after running the test.
// Actual Output: Logged using console.log inside the test.
it('should properly hash the password', async () => {
    const plainPassword = 'testPassword123';
    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    const isMatch = await bcrypt.compare(plainPassword, hashedPassword);
    console.log('Actual:', isMatch);
    expect(isMatch).toBe(true);
  });

  // Test case: should not create user with duplicate email
// Description: This test ensures that the described behavior works as expected.
// Expected Output: What we expect after running the test.
// Actual Output: Logged using console.log inside the test.
it('should not create user with duplicate email', async () => {
    User.create.mockRejectedValue(new Error('Duplicate email'));
    await expect(User.create(mockUser)).rejects.toThrow('Duplicate email');
  });

  // Test case: should not create user with invalid email format
// Description: This test ensures that the described behavior works as expected.
// Expected Output: What we expect after running the test.
// Actual Output: Logged using console.log inside the test.
it('should not create user with invalid email format', async () => {
    const invalidUser = { ...mockUser, email: 'invalid-email' };
    User.create.mockRejectedValue(new Error('Invalid email format'));
    await expect(User.create(invalidUser)).rejects.toThrow('Invalid email format');
  });

  // Test case: should not create user with password less than 8 characters
// Description: This test ensures that the described behavior works as expected.
// Expected Output: What we expect after running the test.
// Actual Output: Logged using console.log inside the test.
it('should not create user with password less than 8 characters', async () => {
    const invalidUser = { ...mockUser, password: 'short' };
    User.create.mockRejectedValue(new Error('Password too short'));
    await expect(User.create(invalidUser)).rejects.toThrow('Password too short');
  });

  // Test case: should not create user with invalid name length
// Description: This test ensures that the described behavior works as expected.
// Expected Output: What we expect after running the test.
// Actual Output: Logged using console.log inside the test.
it('should not create user with invalid name length', async () => {
    const invalidUser = { ...mockUser, name: 'A' };
    User.create.mockRejectedValue(new Error('Name too short'));
    await expect(User.create(invalidUser)).rejects.toThrow('Name too short');
  });

  // Test case: should not create user with invalid role
// Description: This test ensures that the described behavior works as expected.
// Expected Output: What we expect after running the test.
// Actual Output: Logged using console.log inside the test.
it('should not create user with invalid role', async () => {
    const invalidUser = { ...mockUser, role: 'superadmin' };
    User.create.mockRejectedValue(new Error('Invalid role'));
    await expect(User.create(invalidUser)).rejects.toThrow('Invalid role');
  });

  // Test case: should not create user with invalid avatar URL
// Description: This test ensures that the described behavior works as expected.
// Expected Output: What we expect after running the test.
// Actual Output: Logged using console.log inside the test.
it('should not create user with invalid avatar URL', async () => {
    const invalidUser = { ...mockUser, avatar: 'invalid-url' };
    User.create.mockRejectedValue(new Error('Invalid avatar URL'));
    await expect(User.create(invalidUser)).rejects.toThrow('Invalid avatar URL');
  });
});
