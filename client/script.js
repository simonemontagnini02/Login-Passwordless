function mostraToast(messaggio, tipo = "success") {
  const toast = document.getElementById("toast");
  
  // Imposto il testo e il colore
  toast.innerText = messaggio;
  toast.className = `show ${tipo}`; // Aggiunge 'show' e 'success' o 'error'

  // Dopo 3 secondi, lo fa sparire
  setTimeout(() => {
    toast.className = toast.className.replace("show", "").trim();
  }, 3000);
}


async function sendLink() {
  const email = document.getElementById("email").value;
  const btn = document.getElementById("submit-btn");

  if (!email) {
    mostraToast("Inserisci un'email valida!", "error");
    return;
  }

  // Feedback visivo sul pulsante
  btn.disabled = true;
  btn.innerText = "Invio in corso...";

  try {
    const res = await fetch("http://localhost:3000/login", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ email })
    });

    if (res.ok) {
      mostraToast("✅ Magic Link inviato! Controlla la mail.", "success");
    } else {
      mostraToast("❌ Errore dal server.", "error");
    }
  } catch (err) {
    mostraToast("❌ Errore di connessione.", "error");
  } finally {
    // Ripristina il pulsante in ogni caso
    btn.disabled = false;
    btn.innerText = "Invia Magic Link";
  }
}
