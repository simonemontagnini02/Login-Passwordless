const mongoose = require("mongoose");

const CredentialSchema = new mongoose.Schema({
  credentialID: Buffer,
  publicKey: Buffer,
  signCount: Number
});

const UserSchema = new mongoose.Schema({
  email: String,
  userID: Buffer,
  currentChallenge: String,
  credentials: [CredentialSchema]
});

module.exports = mongoose.model("User", UserSchema);