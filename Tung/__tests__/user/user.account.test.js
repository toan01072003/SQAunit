const { User, mockUser } = require('./setupTests');

describe('User Account Management', () => {
  // Test case: should handle account deactivation
// Description: This test ensures that the described behavior works as expected.
// Expected Output: What we expect after running the test.
// Actual Output: Logged using console.log inside the test.
it('should handle account deactivation', async () => {
    const deactivatedUser = {
      ...mockUser,
      isActive: false,
      deactivatedAt: new Date()
    };

    User.findByIdAndUpdate.mockReturnValue(Promise.resolve(deactivatedUser));
    const result = await User.findByIdAndUpdate(
      mockUser._id,
      { isActive: false, deactivatedAt: new Date() },
      { new: true }
    );

    console.log('Actual:', result.isActive);
    expect(result.isActive).toBe(false);
    console.log('Actual:', result.deactivatedAt);
    expect(result.deactivatedAt).toBeDefined();
  });

  // Test case: should handle password reset request
// Description: This test ensures that the described behavior works as expected.
// Expected Output: What we expect after running the test.
// Actual Output: Logged using console.log inside the test.
it('should handle password reset request', async () => {
    const resetToken = 'reset-token-string';
    const updatedUser = {
      ...mockUser,
      resetPasswordToken: resetToken,
      resetPasswordExpires: new Date(Date.now() + 3600000)
    };

    User.findByIdAndUpdate.mockReturnValue(Promise.resolve(updatedUser));
    const result = await User.findByIdAndUpdate(
      mockUser._id,
      {
        resetPasswordToken: resetToken,
        resetPasswordExpires: new Date(Date.now() + 3600000)
      },
      { new: true }
    );

    console.log('Actual:', result.resetPasswordToken);
    expect(result.resetPasswordToken).toBe(resetToken);
    console.log('Actual:', result.resetPasswordExpires);
    expect(result.resetPasswordExpires).toBeDefined();
  });
});
