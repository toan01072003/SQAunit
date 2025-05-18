const { isSuspiciousContextChanged } = require('../controllers/auth.controller');

describe('isSuspiciousContextChanged', () => {
  it('nên trả về true khi có ít nhất một thuộc tính thay đổi', () => {
    const oldContextData = {
      ip: '192.168.1.1',
      country: 'VN',
      city: 'Ho Chi Minh',
      browser: 'Chrome 120.0.0',
      platform: 'Windows',
      os: 'Windows 11',
      device: 'Unknown',
      deviceType: 'Desktop'
    };

    const newContextData = {
      ...oldContextData,
      ip: '192.168.1.2' // thay đổi IP
    };

    const result = isSuspiciousContextChanged(oldContextData, newContextData);
    expect(result).toBe(true);
  });

  it('nên trả về false khi không có thuộc tính nào thay đổi', () => {
    const oldContextData = {
      ip: '192.168.1.1',
      country: 'VN',
      city: 'Ho Chi Minh',
      browser: 'Chrome 120.0.0',
      platform: 'Windows',
      os: 'Windows 11',
      device: 'Unknown',
      deviceType: 'Desktop'
    };

    const newContextData = { ...oldContextData };

    const result = isSuspiciousContextChanged(oldContextData, newContextData);
    expect(result).toBe(false);
  });

  it('nên trả về true khi có nhiều thuộc tính thay đổi', () => {
    const oldContextData = {
      ip: '192.168.1.1',
      country: 'VN',
      city: 'Ho Chi Minh',
      browser: 'Chrome 120.0.0',
      platform: 'Windows',
      os: 'Windows 11',
      device: 'Unknown',
      deviceType: 'Desktop'
    };

    const newContextData = {
      ...oldContextData,
      ip: '192.168.1.2',
      country: 'US',
      city: 'New York'
    };

    const result = isSuspiciousContextChanged(oldContextData, newContextData);
    expect(result).toBe(true);
  });

  it('nên xử lý đúng khi có thuộc tính undefined hoặc null', () => {
    const oldContextData = {
      ip: '192.168.1.1',
      country: 'VN',
      city: null,
      browser: undefined,
      platform: 'Windows',
      os: 'Windows 11',
      device: 'Unknown',
      deviceType: 'Desktop'
    };

    const newContextData = {
      ...oldContextData,
      city: 'Ho Chi Minh',
      browser: 'Chrome 120.0.0'
    };

    const result = isSuspiciousContextChanged(oldContextData, newContextData);
    expect(result).toBe(true);
  });
});