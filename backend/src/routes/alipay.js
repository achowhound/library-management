const https = require('https');
const { AlipaySdk } = require('alipay-sdk');

function formatKey(key) {
  if (!key) return key;
  return key.replace(/\\n/g, '\n');
}

const alipaySdk = new AlipaySdk({
  appId: process.env.ALIPAY_APP_ID || '9021000164628087',
  privateKey: formatKey(process.env.ALIPAY_PRIVATE_KEY) || `-----BEGIN RSA PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDIFHjYFbOaXrP6pfQ175lyr51DNTEiVs/SbvFZeYTUSmfVp/XvFRbP0M+w+F/zhQ7FffUKoU0h1bl4QoJIar6/QdghyxSzwb+fNc7f2HWPLUlf/xVvXmg4FmivK8iBxwKSGmj3OvyCO3DYeHA3BjCF1G7rwQwy2LxSdq7U6LNT8eELockaW6jsoLPvEk68Rv22LDOf9y/YgJDWh6mz5BI3FtKPT8oglRo3F6gMrnSvc7COTavNTMsCvOtUhVGkLK6583rU6mdrIS0kALLgK9iP+q9EsUUC6qPbEc4Z/Xg9dIq1WWFPnU4N0vC+k4jhYzW+PqvKppB3CIR/PQbgg32FAgMBAAECggEBALe9nTCL1XFpkQ0YxEmX7KpWvixPN/0aDiZpPfl2UFaIsgyS/5Z9HoLgdytFHRDM28DgKF2HvgbZeEcJhQ2uAdgwRqTaE/v0bN5wEric13ESHLUs02mAIGOJqL9djPgpY6H64PRSVjvfDIWvLRZK99qfOPIGSgaT5XYxieL6hF0MPvrP3IHiD/LBOszty1D3Z+nYFcK2acYETnlmJvw2rjVaHiYzDSXXAniYNBUG6ZN0YBN0GyD2eQ/k2HZQhCiUp55z93seF8BgCUT7Ktg6nVP+QY/ADoL+Mh6Nh15x+OCbOxH4eRnmT5NhclCbpQds2wRaKWuY3XA3EQKd8WVHMIECgYEA7amRmC6eQW+pHP5zOP5eMkhZI/Q4Hq29DAA4sKBhhz1wep+wN7gLOWBsRl59GaCIg/nMFJK9HmkVq+wAISCr0/ZhyKHiy9sxgfgZYS0tmKHmhE3nqBcvPuM5exgKm0d+eyD75JLSdl8QfsZc2IzDlUjA4X19D0DPmWLMpzSnaiECgYEA14SOVCzlyK/Ukm9LPfxXBHa8U+G29S1F416MDWTUrENq8MX2k6r5YSpm6dx1bU3wgX6WPlZ2Q235VvfQYtMECZhXkCY4RwEAMfiBjbyD0T//7D25xHLpP0l43/htg05kXYZoL0QVVCSUHebz8HlMU95dvZ5MIxJlk1LJauH7zuUCgYBDTzAV+rYFcFtkA8icTqZc9VKRtTwjrC8LdBCaLYIRrFvrzsg4r542LNHdiCtEE8w2HIwpE3oOX9Ksc1WCDF+901zUVs0F0VmPJrYBaKsuPEQuGmZOm+pclDwWWbO/UJtIwgm1LcP/lGL2lLV8+zj1UbqW4lSF+mQRXAL8JBR6IQKBgBwTvt8kgkMk9RKmwSywJT4Fof9jloxWe5ZliOVtz28p0VLQ15DhY1/PQF0TRZEZ6E1WiohQh1O9jhBQdKuLRilh2XaEJCzL6pSYBXjLqHioV9UVLZB0UALYtZCoMsw6eETe78/IlObDZTCIGBuqEdGTVK8RYmXnTahlzqvICSApAoGADWEKk3Omdcn7pFqaL5DRr+xcoOmhvcFr4wTpgAEM8VPz5E6pl8uy7XjP9dHJT8n9ECSKpzQ3Y/Bef3oz0bzUk7dRtla7Qi9LrQo9rJ8Etf1T8qZ8Eb2YEspN6kXAi9WW6B8ncIa6Q2g7EsCWk3cVl0q+cbwp7d2b8A6GqQAdLWI=
-----END RSA PRIVATE KEY-----`,
  alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY || 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAsGhuuoV5A/kfJLqCNNpk08NBSxPO9kkXbSkBfKkimSp6f6q2+Gy3tLv9SPszMihAHAckr2c1wOfERhXkXyHjcXAwO2RGMSCHEJoM+ByWbmshh/rpRwpMAN+r33gXAuvai076byZoT7VouBDGy8xIkk722Y+vbMFNhwNjWUUwpjhAvzSSoEyasjhEaqsSzfL8ha8bKo1B0CfmarNAE6sIhFy//Hs2Ond7o8uoSir1Pm1PO9YdLkpoaQryYPAJJ0mojft4GJpg78NLRBgh/otkeNOowOqoLnf54oKDBePy+4/ItmK4XhtPR8Q0/tl87Hsbj+WOzmeqKJlZjruPCmCGAQIDAQAB',
  gateway: process.env.ALIPAY_GATEWAY || 'https://openapi-sandbox.dl.alipaydev.com/gateway.do',
  signType: 'RSA2',
  charset: 'UTF-8',
  timeout: 60000,
  httpAgent: new https.Agent({
    rejectUnauthorized: false,
    keepAlive: true,
  }),
  httpsAgent: new https.Agent({
    rejectUnauthorized: false,
    keepAlive: true,
  }),
});

function getFrontendUrl() {
  return process.env.FRONTEND_URL || 'http://localhost:5173';
}

function getPublicBaseUrl() {
  if (process.env.ALIPAY_PUBLIC_BASE_URL) {
    return process.env.ALIPAY_PUBLIC_BASE_URL.replace(/\/$/, '');
  }
  const notifyUrl = process.env.ALIPAY_NOTIFY_URL || '';
  if (notifyUrl) {
    return notifyUrl.replace(/\/api\/reader\/alipay-notify\/?$/, '');
  }
  return '';
}

function getAlipayReturnUrl() {
  if (process.env.ALIPAY_RETURN_URL) {
    return process.env.ALIPAY_RETURN_URL;
  }
  const publicBase = getPublicBaseUrl();
  if (publicBase) {
    // 沙箱不接受 localhost 作为 return_url，经 ngrok 公网地址回跳
    return `${publicBase}/api/reader/alipay-return`;
  }
  return `${getFrontendUrl()}/history`;
}

function getAlipayNotifyUrl() {
  return process.env.ALIPAY_NOTIFY_URL || '';
}

/**
 * 电脑网站支付：使用 GET 方式生成完整跳转 URL。
 * POST 表单会把 sign 放在 action 查询串里，浏览器提交时 + 号会被错误解码导致 invalid-signature。
 */
function buildPagePayUrl(method, bizParams) {
  const payUrl = alipaySdk.pageExec(method, 'GET', bizParams);

  if (!payUrl || !payUrl.includes('sign=') || !payUrl.includes('biz_content=')) {
    throw new Error('支付宝支付参数不完整');
  }

  return payUrl;
}

module.exports = alipaySdk;
module.exports.buildPagePayUrl = buildPagePayUrl;
module.exports.getAlipayReturnUrl = getAlipayReturnUrl;
module.exports.getAlipayNotifyUrl = getAlipayNotifyUrl;
module.exports.getFrontendUrl = getFrontendUrl;
module.exports.getPublicBaseUrl = getPublicBaseUrl;
