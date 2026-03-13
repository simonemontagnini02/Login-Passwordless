const mongoose = require("mongoose");

const tokenSchema = new mongoose.Schema({
  email: String,
  tokenHash: String,
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 }
  }
});

module.exports = mongoose.model("Token", tokenSchema);
