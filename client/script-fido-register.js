const registerBtn = document.getElementById("registerBtn");

registerBtn.addEventListener("click", async () => {
  const email = document.getElementById("email").value;

  if (!email) {
    alert("Inserisci email");
    return;
  }

  // 1. Chiedo al server le opzioni
  const optionsRes = await fetch("http://localhost:3000/fido/register/options", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email })
  });

  const options = await optionsRes.json();
  console.log("OPTIONS dal server:", options);

  if (options.error) {
    alert("Errore dal server: " + options.error);
    return;
  }

  // Converto challenge e userID in ArrayBuffer
  options.challenge = base64urlToBuffer(options.challenge);
  options.user.id = base64urlToBuffer(options.user.id);

  // 2. Creo credenziale
  const credential = await navigator.credentials.create({
    publicKey: options
  });

  // 3. Invio risposta al server
  const attestationResponse = {
    id: credential.id,
    rawId: bufferToBase64url(credential.rawId),
    type: credential.type,
    response: {
      attestationObject: bufferToBase64url(credential.response.attestationObject),
      clientDataJSON: bufferToBase64url(credential.response.clientDataJSON)
    }
  };

  console.log("attestationResponse da inviare al server:", attestationResponse);
    
  const verifyRes = await fetch("http://localhost:3000/fido/register/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, attestationResponse })
  });

  console.log("OPTIONS dal server:", JSON.stringify(options, null, 2));

  const result = await verifyRes.json();

  if (result.success) {
    window.location.href = "fido-login.html";
  } else {
    mostraToast("❌ Errore durante la registrazione", "error");
  }
});

// ===== UTILITY FUNCTIONS =====
function bufferToBase64url(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function base64urlToBuffer(base64url) {
  const padding = "=".repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const raw = atob(base64);
  return Uint8Array.from([...raw].map(char => char.charCodeAt(0)));
}