let tokenClient = null;
let accessToken = null;



export async function initDriveAuth({ clientId, scope }) {
  // Attendre que le script Google soit chargé
  await waitForGoogle();

  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope,
    callback: () => {},
  });
}

function waitForGoogle(timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();

    const tick = () => {
      if (window.google?.accounts?.oauth2) return resolve();
      if (Date.now() - start > timeoutMs) {
        return reject(new Error("Google Identity Services non chargé (gsi/client)"));
      }
      setTimeout(tick, 50);
    };

    tick();
  });
}





export function isDriveConnected() {
  return !!accessToken;
}

/** Retourne le token courant (null si non connecté) */
export function getAccessToken() {
  return accessToken;
}

/** Retourne uniquement les métadonnées du fichier de backup (id, name, modifiedTime)
 *  sans télécharger le contenu — utile pour comparer les dates avant de restaurer.
 */
export async function getBackupMetadata(name) {
  return findFileByName(name); // retourne { id, name, modifiedTime } ou null
}

export function requestDriveToken() {
  return new Promise((resolve, reject) => {
    if (!tokenClient) return reject(new Error("Drive auth not initialized"));
    tokenClient.callback = (resp) => {
      if (resp?.access_token) {
        accessToken = resp.access_token;
        resolve(accessToken);
      } else {
        reject(new Error("No access token"));
      }
    };
    tokenClient.requestAccessToken({ prompt: "consent" });
  });
}

/**
 * Tente d'obtenir un token sans afficher de popup (mode silencieux).
 * Résout avec le token si Google a une session active,
 * rejette dans les autres cas (session expirée, pas de session, timeout).
 * Timeout 5s pour éviter de rester bloqué si Google ne répond pas.
 */
export function requestDriveTokenSilent() {
  return new Promise((resolve, reject) => {
    if (!tokenClient) return reject(new Error("Drive auth not initialized"));

    let settled = false;
    const done = (fn, val) => {
      if (settled) return;
      settled = true;
      fn(val);
    };

    // Timeout de sécurité : si Google ne répond pas en 5s, on rejette
    const timer = setTimeout(() => done(reject, new Error("Silent auth timeout")), 5000);

    tokenClient.callback = (resp) => {
      clearTimeout(timer);
      if (resp?.access_token) {
        accessToken = resp.access_token;
        done(resolve, accessToken);
      } else {
        // resp.error peut être "interaction_required", "access_denied", etc.
        done(reject, new Error(resp?.error || "Silent auth failed"));
      }
    };

    tokenClient.error_callback = (err) => {
      clearTimeout(timer);
      done(reject, new Error(err?.type || "Silent auth error"));
    };

    // prompt: "" = pas de popup, Google utilise la session existante
    tokenClient.requestAccessToken({ prompt: "" });
  });
}

async function driveFetch(url, options = {}) {
  if (!accessToken) throw new Error("Not connected to Drive");
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Drive API error ${res.status}: ${txt}`);
  }
  return res;
}

export async function findFileByName(name) {
  const q = encodeURIComponent(`name='${name.replace(/'/g, "\\'")}' and trashed=false`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime)`;
  const res = await driveFetch(url);
  const json = await res.json();
  return json.files?.[0] || null;
}

export async function uploadOrUpdateFile({ name, mimeType, content }) {
  // content: string (JSON) ou Blob converti en string
  const existing = await findFileByName(name);

  const boundary = "-------314159265358979323846";
  const metadata = { name, mimeType };

  const multipartBody =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${mimeType}\r\n\r\n` +
    `${content}\r\n` +
    `--${boundary}--`;

  if (!existing) {
    const url = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime";
    const res = await driveFetch(url, {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body: multipartBody,
    });
    return res.json();
  } else {
    const url = `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=multipart&fields=id,name,modifiedTime`;
    const res = await driveFetch(url, {
      method: "PATCH",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body: multipartBody,
    });
    return res.json();
  }
}



export async function downloadFileByName(name) {
  const existing = await findFileByName(name);
  if (!existing) throw new Error("Backup introuvable dans Drive");

  const res = await driveFetch(`https://www.googleapis.com/drive/v3/files/${existing.id}?alt=media`);
  return await res.text(); // JSON string
}
