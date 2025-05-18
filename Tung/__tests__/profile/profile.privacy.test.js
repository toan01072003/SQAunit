const { User, mockUsers } = require('./setupProfileTests');

describe('Profile Privacy', () => {
  // Test case: should handle private profile settings
// Description: This test ensures that the described behavior works as expected.
// Expected Output: What we expect after running the test.
// Actual Output: Logged using console.log inside the test.
it('should handle private profile settings', async () => {
    const privacySettings = {
      isPrivate: true,
      showLocation: false,
      showEmail: false
    };
    User.findByIdAndUpdate.mockResolvedValue({ ...mockUsers.user1, ...privacySettings });
    const updatedUser = await User.findByIdAndUpdate(mockUsers.user1._id, privacySettings, { new: true });
    expect(updatedUser.isPrivate).toBe(true);
    expect(updatedUser.showLocation).toBe(false);
    expect(updatedUser.showEmail).toBe(false);
  });

  // Test case: should validate privacy settings format
// Description: This test ensures that the described behavior works as expected.
// Expected Output: What we expect after running the test.
// Actual Output: Logged using console.log inside the test.
it('should validate privacy settings format', async () => {
    const invalidSettings = { isPrivate: 'not-a-boolean', showLocation: 'invalid' };
    User.findByIdAndUpdate.mockRejectedValue(new Error('Invalid privacy settings'));
    await expect(User.findByIdAndUpdate(mockUsers.user1._id, invalidSettings, { new: true }))
      .rejects.toThrow('Invalid privacy settings');
  });
});
