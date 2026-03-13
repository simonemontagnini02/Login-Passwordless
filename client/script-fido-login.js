const loginBtn = document.getElementById("loginBtn");

loginBtn.addEventListener("click", async () => {
  const email = document.getElementById("email").value;

  if (!email) {
    alert("Inserisci email");
    return;
  }

  // 1. Chiedi opzioni al server
  const optionsRes = await fetch("http://localhost:3000/fido/login/options", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email })
  });

  const options = await optionsRes.json();

  console.log("OPTIONS DAL SERVER:", options);

  if (options.error) {
    alert(options.error);
    return;
  }

  // Converti challenge
  options.challenge = base64urlToBuffer(options.challenge);

  options.allowCredentials = options.allowCredentials.map(cred => ({
    ...cred,
    id: base64urlToBuffer(cred.id)
  }));

  // 2. Richiedi autenticazione
  const assertion = await navigator.credentials.get({
    publicKey: options
  });

  const assertionResponse = {
    id: assertion.id,
    rawId: bufferToBase64url(assertion.rawId),
    type: assertion.type,
    response: {
      authenticatorData: bufferToBase64url(assertion.response.authenticatorData),
      clientDataJSON: bufferToBase64url(assertion.response.clientDataJSON),
      signature: bufferToBase64url(assertion.response.signature),
      userHandle: assertion.response.userHandle
        ? bufferToBase64url(assertion.response.userHandle)
        : null
    }
  };

  // 3. Invia al server
  const verifyRes = await fetch("http://localhost:3000/fido/login/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, assertionResponse })
  });

  const result = await verifyRes.json();

  if (result.success) {

    // SALVATAGGIO TOKEN NEL BROWSER
    localStorage.setItem("jwt", result.token)

    window.location.href = "welcome.html";
  } else {
    mostraToast("❌ Credenziali non valide", "error");
  }
});

// ===== FUNZIONI UTILI =====
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