const { Builder, By, until } = require('selenium-webdriver');
const assert = require('assert');
const { describe, it, before, after } = require('mocha');

describe('Sign In Tests', () => {
  let driver;

  before(async () => {
    driver = await new Builder().forBrowser('chrome').build();
    await driver.manage().setTimeouts({ implicit: 10000 });
  });

  after(async () => {
    await driver.quit();
  });

  it('should sign in successfully with valid credentials', async () => {
    await driver.get('http://localhost:3000/signin');
    
    // Wait for the page to load completely
    await driver.wait(until.elementLocated(By.css('form')), 10000);

    // Find and fill in the email field
    const emailInput = await driver.findElement(By.name('email'));
    await emailInput.sendKeys('test@example.com');

    // Find and fill in the password field
    const passwordInput = await driver.findElement(By.name('password'));
    await passwordInput.sendKeys('testpassword');

    // Find and click the sign-in button using text content
    const signInButton = await driver.findElement(
      By.xpath("//button[contains(text(), 'Sign in')]")
    );
    await signInButton.click();

    // Wait for success message with correct class
    const successElement = await driver.wait(
      until.elementLocated(By.css('.text-green-700')),
      10000
    );
    assert.ok(await successElement.isDisplayed());
  });

  it('should show error message with invalid credentials', async () => {
    await driver.get('http://localhost:3000/signin');
    
    await driver.wait(until.elementLocated(By.css('form')), 10000);

    const emailInput = await driver.findElement(By.name('email'));
    await emailInput.sendKeys('invalid@example.com');

    const passwordInput = await driver.findElement(By.name('password'));
    await passwordInput.sendKeys('wrongpassword');

    const signInButton = await driver.findElement(
      By.xpath("//button[contains(text(), 'Sign in')]")
    );
    await signInButton.click();

    // Wait for error message with correct class
    const errorElement = await driver.wait(
      until.elementLocated(By.css('.text-red-700')),
      10000
    );
    const errorText = await errorElement.getText();
    assert.ok(errorText.includes('Invalid'));
  });

  it('should handle context-based authentication', async () => {
    await driver.get('http://localhost:3000/signin');
    
    await driver.wait(until.elementLocated(By.css('form')), 10000);

    const emailInput = await driver.findElement(By.name('email'));
    await emailInput.sendKeys('user@example.com');

    const passwordInput = await driver.findElement(By.name('password'));
    await passwordInput.sendKeys('password123');

    const signInButton = await driver.findElement(
      By.xpath("//button[contains(text(), 'Sign in')]")
    );
    await signInButton.click();

    // Wait for either context message or success message
    try {
      const contextMessage = await driver.wait(
        until.elementLocated(By.css('.text-red-700')),
        10000
      );
      const messageText = await contextMessage.getText();
      assert.ok(messageText.includes('verification'));
    } catch (error) {
      const successElement = await driver.wait(
        until.elementLocated(By.css('.text-green-700')),
        10000
      );
      assert.ok(await successElement.isDisplayed());
    }
  });
});