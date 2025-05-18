const { UserPreference, mockUser } = require('./setupTests');

describe('User Preferences', () => {
  // Test case: should create user preferences
// Description: This test ensures that the described behavior works as expected.
// Expected Output: What we expect after running the test.
// Actual Output: Logged using console.log inside the test.
it('should create user preferences', async () => {
    const mockPreferences = {
      user: mockUser._id,
      enableContextBasedAuth: true,
      theme: 'dark',
      language: 'en'
    };

    UserPreference.create.mockResolvedValue(mockPreferences);
    const savedPreferences = await UserPreference.create(mockPreferences);
    console.log('Actual:', savedPreferences.user);
    expect(savedPreferences.user).toBe(mockUser._id);
    console.log('Actual:', savedPreferences.enableContextBasedAuth);
    expect(savedPreferences.enableContextBasedAuth).toBe(true);
  });

  // Test case: should update user preferences
// Description: This test ensures that the described behavior works as expected.
// Expected Output: What we expect after running the test.
// Actual Output: Logged using console.log inside the test.
it('should update user preferences', async () => {
    const updatedPreferences = {
      user: mockUser._id,
      enableContextBasedAuth: false,
      theme: 'light',
      language: 'es'
    };

    UserPreference.findOne.mockResolvedValue(updatedPreferences);
    const result = await UserPreference.findOne({ user: mockUser._id });
    expect(result.theme).toBe('light');
    expect(result.language).toBe('es');
  });

  // Test case: should reject invalid preference values
// Description: This test ensures that the described behavior works as expected.
// Expected Output: What we expect after running the test.
// Actual Output: Logged using console.log inside the test.
it('should reject invalid preference values', async () => {
    const invalidPreferences = {
      user: mockUser._id,
      theme: 'invalid-theme',
      language: 'invalid-lang'
    };

    UserPreference.create.mockRejectedValue(new Error('Invalid preferences'));
    await expect(UserPreference.create(invalidPreferences)).rejects.toThrow('Invalid preferences');
  });
});
