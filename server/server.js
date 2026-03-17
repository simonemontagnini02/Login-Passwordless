require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const crypto = require("crypto");
const cors = require("cors");
const jwt = require("jsonwebtoken");

const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse
} = require("@simplewebauthn/server");

const Token = require("./models/Token");
const User = require("./models/User");
const sendMagicLink = require("./emailService");

const app = express();
app.use(express.json());
app.use(cors());

// =====================
// CONFIG WEBAUTHN
// =====================
const rpID = "localhost";
const origin = "http://localhost:5500"; // dove gira il client (Live Server)

// =====================
// MONGODB
// =====================
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connesso"))
  .catch(err => console.error("Errore connessione MongoDB:", err));

// =====================
// MAGIC LINK
// =====================

// Funzione hash token
function tokenToHash(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

//Funzione helper
function base64urlToBuffer(base64url) {
  const padding = "=".repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = Buffer.from(base64, "base64");
  return new Uint8Array(raw);
}

// Login - invio magic link
app.post("/login", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email mancante" });

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = tokenToHash(token);

  await Token.deleteMany({ email });

  await Token.create({
    email,
    tokenHash,
    expiresAt: Date.now() + 5 * 60 * 1000
  });

  const link = `http://localhost:${process.env.PORT}/auth/${token}`;
  await sendMagicLink(email, link);

  res.json({ message: "Link inviato alla tua email" });
});

// Magic link - autenticazione
app.get("/auth/:token", async (req, res) => {
  const tokenHash = tokenToHash(req.params.token);

  const record = await Token.findOne({
    tokenHash,
    expiresAt: { $gt: Date.now() }
  });

  if (!record) {
    return res.redirect("http://localhost:5500/index.html?error=token_scaduto");
  }

  await Token.deleteOne({ _id: record._id });

  // CREO IL TOKEN JWT
  const jwtToken = jwt.sign(
    { email: record.email }, 
    process.env.JWT_SECRET, 
    { expiresIn: "1h" }
  );

  res.redirect(`http://localhost:5500/welcome.html#token=${jwtToken}`);
});

// =====================
// FIDO2 / WEB AUTHN
// =====================

// REGISTRAZIONE - genera challenge
app.post("/fido/register/options", async (req, res) => {
  try{
    const { email } = req.body;

    let user = await User.findOne({ email });

    if (!user) {
      const userIDBuffer = crypto.randomBytes(32);

      user = await User.create({
        email,
        userID: userIDBuffer, // Buffer
        credentials: []
      });
    }

    //Genero le opzioni FIDO2 passando Buffer
    const options = await generateRegistrationOptions({
      rpName: "Passwordless Project",
      rpID,
      userID: user.userID,
      userName: email,
      timeout: 60000,
      attestationType: "none"
    });

    user.currentChallenge = options.challenge;
    await user.save();

    res.json(options);
  } catch (err) {
    console.error("ERRORE /fido/register/options:", err);
    res.status(500).json({ error: "Errore server interno" });
  }
});

// REGISTRAZIONE - verifica
app.post("/fido/register/verify", async (req, res) => {
  const { email, attestationResponse } = req.body;
  
  const user = await User.findOne({ email });

  if (!user) {
    return res.status(400).json({ error: "User not found" });
  }

  const verification = await verifyRegistrationResponse({
    response: attestationResponse,
    expectedChallenge: user.currentChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID
  });

  const { verified, registrationInfo } = verification;

  if (verified && registrationInfo) {
    const { credential } = registrationInfo;

  if (!credential || !credential.id || !credential.publicKey) {
    return res.status(400).json({ error: "Registration info incompleta" });
  }

  user.credentials.push({
    credentialID: Buffer.from(credential.id, 'base64url'), // Converte la stringa base64url in Buffer
    publicKey: Buffer.from(credential.publicKey),
    signCount: credential.counter || 0
  });

  user.currentChallenge = undefined;
  await user.save();
  return res.json({ success: true });
  } else {
    return res.status(400).json({ error: "Registrazione fallita" });
  }

});

// LOGIN - genera challenge
app.post("/fido/login/options", async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });

  if (!user) return res.json({ error: "Utente non registrato" });

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: user.credentials.map(cred => ({
      id: cred.credentialID.toString("base64url"),
      type: "public-key"
    }))
  });

  user.currentChallenge = options.challenge;
  await user.save();

  res.json(options);
});

// LOGIN - verifica
app.post("/fido/login/verify", async (req, res) => {
  const { email, assertionResponse } = req.body;
  const user = await User.findOne({ email });

  const credential = user.credentials[0];

  const verification = await verifyAuthenticationResponse({
    response: assertionResponse,
    expectedChallenge: user.currentChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    credential: {
      id: credential.credentialID.toString("base64url"), 
      publicKey: credential.publicKey,
      counter: credential.signCount
    }
  });

  if (!verification.verified) {
    return res.json({ error: "Login fallito" });
  }

  credential.signCount = verification.authenticationInfo.newCounter;
  user.currentChallenge = undefined;
  await user.save();

  // CREAZIONE TOKEN FIRMATO CON JWT_SECRET
  const token = jwt.sign(
    { email: user.email }, 
    process.env.JWT_SECRET, 
    { expiresIn: "1h" } // Scade dopo un'ora
  );


  res.json({ success: true, token: token });
});

// =====================
// AVVIO SERVER
// =====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server avviato su http://localhost:${PORT}`));