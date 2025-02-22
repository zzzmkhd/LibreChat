const mongoose = require('mongoose');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { REFRESH_TOKEN_EXPIRY } = process.env ?? {};
const expires = eval(REFRESH_TOKEN_EXPIRY) ?? 1000 * 60 * 60 * 24 * 7;

const sessionSchema = mongoose.Schema({
  refreshTokenHash: {
    type: String,
    required: true,
  },
  expiration: {
    type: Date,
    required: true,
    expires: 0,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
});

sessionSchema.methods.generateRefreshToken = async function () {
  try {
    let expiresIn;
    if (this.expiration) {
      expiresIn = this.expiration.getTime();
    } else {
      expiresIn = Date.now() + expires;
      this.expiration = new Date(expiresIn);
    }

    const refreshToken = jwt.sign(
      {
        id: this.user,
      },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: Math.floor((expiresIn - Date.now()) / 1000) },
    );

    const hash = crypto.createHash('sha256');
    this.refreshTokenHash = hash.update(refreshToken).digest('hex');

    await this.save();

    return refreshToken;
  } catch (error) {
    console.error(
      'Error generating refresh token. Have you set a JWT_REFRESH_SECRET in the .env file?\n\n',
      error,
    );
    throw error;
  }
};

const Session = mongoose.model('Session', sessionSchema);

module.exports = Session;
