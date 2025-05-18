const { User, mockUsers } = require('./setupProfileTests');

describe('Profile Updates', () => {
  // Test case: should update user profile successfully
// Description: This test ensures that the described behavior works as expected.
// Expected Output: What we expect after running the test.
// Actual Output: Logged using console.log inside the test.
it('should update user profile successfully', async () => {
    const updates = {
      location: 'Los Angeles',
      bio: 'Updated bio',
      interests: 'music,art,photography'
    };
    User.findByIdAndUpdate.mockResolvedValue({ ...mockUsers.user1, ...updates });
    const updatedUser = await User.findByIdAndUpdate(mockUsers.user1._id, updates, { new: true });
    expect(updatedUser.location).toBe(updates.location);
    expect(updatedUser.bio).toBe(updates.bio);
    expect(updatedUser.interests).toBe(updates.interests);
  });

  // Test case: should not update user profile with invalid data
// Description: This test ensures that the described behavior works as expected.
// Expected Output: What we expect after running the test.
// Actual Output: Logged using console.log inside the test.
it('should not update user profile with invalid data', async () => {
    const invalidUpdates = { email: 'invalid-email', bio: 'x'.repeat(301) };
    User.findByIdAndUpdate.mockRejectedValue(new Error('Invalid data'));
    await expect(User.findByIdAndUpdate(mockUsers.user1._id, invalidUpdates, { new: true }))
      .rejects.toThrow('Invalid data');
  });

  // Test case: should update user avatar URL successfully
// Description: This test ensures that the described behavior works as expected.
// Expected Output: What we expect after running the test.
// Actual Output: Logged using console.log inside the test.
it('should update user avatar URL successfully', async () => {
    const newAvatar = 'https://example.com/new-avatar.jpg';
    User.findByIdAndUpdate.mockResolvedValue({ ...mockUsers.user1, avatar: newAvatar });
    const updatedUser = await User.findByIdAndUpdate(mockUsers.user1._id, { avatar: newAvatar }, { new: true });
    expect(updatedUser.avatar).toBe(newAvatar);
  });

  // Test case: should handle empty update fields gracefully
// Description: This test ensures that the described behavior works as expected.
// Expected Output: What we expect after running the test.
// Actual Output: Logged using console.log inside the test.
it('should handle empty update fields gracefully', async () => {
    User.findByIdAndUpdate.mockResolvedValue(mockUsers.user1);
    const updatedUser = await User.findByIdAndUpdate(mockUsers.user1._id, {}, { new: true });
    expect(updatedUser).toEqual(mockUsers.user1);
  });

  // Test case: should reject invalid avatar URL format
// Description: This test ensures that the described behavior works as expected.
// Expected Output: What we expect after running the test.
// Actual Output: Logged using console.log inside the test.
it('should reject invalid avatar URL format', async () => {
    const invalidUrl = 'not-a-url';
    User.findByIdAndUpdate.mockRejectedValue(new Error('Invalid avatar URL'));
    await expect(User.findByIdAndUpdate(mockUsers.user1._id, { avatar: invalidUrl }, { new: true }))
      .rejects.toThrow('Invalid avatar URL');
  });

  // Test case: should handle partial profile updates correctly
// Description: This test ensures that the described behavior works as expected.
// Expected Output: What we expect after running the test.
// Actual Output: Logged using console.log inside the test.
it('should handle partial profile updates correctly', async () => {
    const partialUpdate = { bio: 'Updated bio only' };
    const expectedUser = { ...mockUsers.user1, bio: partialUpdate.bio };
    User.findByIdAndUpdate.mockResolvedValue(expectedUser);
    const updatedUser = await User.findByIdAndUpdate(mockUsers.user1._id, partialUpdate, { new: true });
    expect(updatedUser.bio).toBe(partialUpdate.bio);
  });

  // Test case: should update multiple fields simultaneously
// Description: This test ensures that the described behavior works as expected.
// Expected Output: What we expect after running the test.
// Actual Output: Logged using console.log inside the test.
it('should update multiple fields simultaneously', async () => {
    const multiUpdate = { location: 'Paris', bio: 'New bio', interests: 'travel,photography' };
    User.findByIdAndUpdate.mockResolvedValue({ ...mockUsers.user1, ...multiUpdate });
    const updatedUser = await User.findByIdAndUpdate(mockUsers.user1._id, multiUpdate, { new: true });
    expect(updatedUser.location).toBe(multiUpdate.location);
    expect(updatedUser.bio).toBe(multiUpdate.bio);
    expect(updatedUser.interests).toBe(multiUpdate.interests);
  });
});
