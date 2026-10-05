const request = require('supertest');
const emailService = require('../services/email.service');

/**
 * Sign up the way the website does: ask for the email code, read it from the
 * outgoing email (caught here instead of sent), then create the account with it.
 * Resolves to the response of the last step that ran, like a single request would.
 */
exports.registerUser = async (app, user) => {
  const sendCode = jest.spyOn(emailService, 'sendOtpEmail').mockResolvedValue({});
  try {
    const sent = await request(app).post('/api/auth/otp/send').send({ email: user.email });
    if (sent.statusCode !== 200) return sent;
    const { code } = sendCode.mock.calls.at(-1)[0];
    return await request(app).post('/api/auth/register').send({ ...user, code });
  } finally {
    sendCode.mockRestore();
  }
};
