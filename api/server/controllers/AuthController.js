const {
  registerUser,
  requestPasswordReset,
  resetPassword,
  setAuthTokens,
} = require('../services/AuthService');
const jwt = require('jsonwebtoken');
const Session = require('../../models/Session');
const User = require('../../models/User');
const crypto = require('crypto');
const cookies = require('cookie');

const registrationController = async (req, res) => {
  try {
    const response = await registerUser(req.body);
    if (response.status === 200) {
      const { status, user } = response;
      let newUser = await User.findOne({ _id: user._id });
      if (!newUser) {
        newUser = new User(user);
        await newUser.save();
      }
      const token = await setAuthTokens(user._id, res);
      res.setHeader('Authorization', `Bearer ${token}`);
      res.status(status).send({ user });
    } else {
      const { status, message } = response;
      res.status(status).send({ message });
    }
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: err.message });
  }
};

const getUserController = async (req, res) => {
  return res.status(200).send(req.user);
};

const resetPasswordRequestController = async (req, res) => {
  try {
    const resetService = await requestPasswordReset(req.body.email);
    if (resetService instanceof Error) {
      return res.status(400).json(resetService);
    } else {
      return res.status(200).json(resetService);
    }
  } catch (e) {
    console.log(e);
    return res.status(400).json({ message: e.message });
  }
};

const resetPasswordController = async (req, res) => {
  try {
    const resetPasswordService = await resetPassword(
      req.body.userId,
      req.body.token,
      req.body.password,
    );
    if (resetPasswordService instanceof Error) {
      return res.status(400).json(resetPasswordService);
    } else {
      return res.status(200).json(resetPasswordService);
    }
  } catch (e) {
    console.log(e);
    return res.status(400).json({ message: e.message });
  }
};

const refreshController = async (req, res) => {
  const refreshToken = req.headers.cookie ? cookies.parse(req.headers.cookie).refreshToken : null;
  if (!refreshToken) {
    return res.status(200).send('Refresh token not provided');
  }

  try {
    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const userId = payload.id;
    const user = await User.findOne({ _id: userId });
    if (!user) {
      return res.status(401).send('User not found');
    }

    if (process.env.NODE_ENV === 'development') {
      const token = await setAuthTokens(userId, res);
      const userObj = user.toJSON();
      return res.status(200).send({ token, user: userObj });
    }

    // Hash the refresh token
    const hash = crypto.createHash('sha256');
    const hashedToken = hash.update(refreshToken).digest('hex');

    // Find the session with the hashed refresh token
    const session = await Session.findOne({ user: userId, refreshTokenHash: hashedToken });
    if (session && session.expiration > new Date()) {
      const token = await setAuthTokens(userId, res, session._id);
      const userObj = user.toJSON();
      res.status(200).send({ token, user: userObj });
    } else {
      res.status(401).send('Refresh token expired or not found for this user');
    }
  } catch (err) {
    res.status(401).send('Invalid refresh token');
  }
};

module.exports = {
  getUserController,
  refreshController,
  registrationController,
  resetPasswordRequestController,
  resetPasswordController,
};
