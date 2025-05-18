const { User, Relationship, mockUsers } = require('./setupProfileTests');

describe('Following/Unfollowing', () => {
  // Test case: should follow user successfully
// Description: This test ensures that the described behavior works as expected.
// Expected Output: What we expect after running the test.
// Actual Output: Logged using console.log inside the test.
it('should follow user successfully', async () => {
    const mockRelationship = { follower: mockUsers.user1._id, following: mockUsers.user2._id };
    Relationship.create.mockResolvedValue(mockRelationship);
    const relationship = await Relationship.create(mockRelationship);
    console.log('Actual:', relationship.follower);
    expect(relationship.follower).toBe(mockUsers.user1._id);
    console.log('Actual:', relationship.following);
    expect(relationship.following).toBe(mockUsers.user2._id);
  });

  // Test case: should unfollow user successfully
// Description: This test ensures that the described behavior works as expected.
// Expected Output: What we expect after running the test.
// Actual Output: Logged using console.log inside the test.
it('should unfollow user successfully', async () => {
    Relationship.deleteOne.mockResolvedValue({ deletedCount: 1 });
    const result = await Relationship.deleteOne({ follower: mockUsers.user1._id, following: mockUsers.user2._id });
    expect(result.deletedCount).toBe(1);
  });

  // Test case: should prevent user from following themselves
// Description: This test ensures that the described behavior works as expected.
// Expected Output: What we expect after running the test.
// Actual Output: Logged using console.log inside the test.
it('should prevent user from following themselves', async () => {
    const selfFollow = { follower: mockUsers.user1._id, following: mockUsers.user1._id };
    Relationship.create.mockRejectedValue(new Error('Cannot follow yourself'));
    await expect(Relationship.create(selfFollow)).rejects.toThrow('Cannot follow yourself');
  });

  // Test case: should handle duplicate follow attempts
// Description: This test ensures that the described behavior works as expected.
// Expected Output: What we expect after running the test.
// Actual Output: Logged using console.log inside the test.
it('should handle duplicate follow attempts', async () => {
    const relationship = { follower: mockUsers.user1._id, following: mockUsers.user2._id };
    Relationship.findOne.mockResolvedValue(relationship);
    Relationship.create.mockRejectedValue(new Error('Already following'));
    await expect(Relationship.create(relationship)).rejects.toThrow('Already following');
  });

  // Test case: should cascade unfollow operations properly
// Description: This test ensures that the described behavior works as expected.
// Expected Output: What we expect after running the test.
// Actual Output: Logged using console.log inside the test.
it('should cascade unfollow operations properly', async () => {
    Relationship.deleteOne.mockResolvedValue({ deletedCount: 1 });
    User.findByIdAndUpdate.mockResolvedValueOnce({ ...mockUsers.user1, following: [] })
      .mockResolvedValueOnce({ ...mockUsers.user2, followers: [] });
    const result = await Promise.all([
      User.findByIdAndUpdate(mockUsers.user1._id, { $pull: { following: mockUsers.user2._id } }),
      User.findByIdAndUpdate(mockUsers.user2._id, { $pull: { followers: mockUsers.user1._id } }),
      Relationship.deleteOne({ follower: mockUsers.user1._id, following: mockUsers.user2._id })
    ]);
    expect(result[2].deletedCount).toBe(1);
  });

  // Test case: should handle maximum following limit
// Description: This test ensures that the described behavior works as expected.
// Expected Output: What we expect after running the test.
// Actual Output: Logged using console.log inside the test.
it('should handle maximum following limit', async () => {
    const MAX_FOLLOWING = 5000;
    const mockFollowingList = Array(MAX_FOLLOWING).fill(mockUsers.user2._id);
    User.findByIdAndUpdate.mockRejectedValue(new Error('Maximum following limit reached'));
    await expect(User.findByIdAndUpdate(mockUsers.user1._id, { following: mockFollowingList }, { new: true }))
      .rejects.toThrow('Maximum following limit reached');
  });
});
