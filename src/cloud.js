const CONFIG = window.LEARNING_CLOUD_CONFIG || { apiKey: "", projectId: "" };

const AUTH_BASE = "https://identitytoolkit.googleapis.com/v1/accounts";

export const hasCloudConfig = () => Boolean(CONFIG.apiKey && CONFIG.projectId);

const assertCloudConfig = () => {
  if (!hasCloudConfig()) {
    throw new Error("尚未設定 Firebase 雲端設定。請複製 config.example.js 為 config.js 並填入 apiKey 與 projectId。");
  }
};

const authRequest = async (path, payload) => {
  assertCloudConfig();
  const response = await fetch(`${AUTH_BASE}:${path}?key=${CONFIG.apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, returnSecureToken: true }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || "雲端身份驗證失敗");
  }
  return data;
};

export const signIn = (email, password) => authRequest("signInWithPassword", { email, password });
export const signUp = (email, password) => authRequest("signUp", { email, password });

const firestoreBase = () => {
  assertCloudConfig();
  return `https://firestore.googleapis.com/v1/projects/${CONFIG.projectId}/databases/(default)/documents`;
};

const toFirestoreValue = (value) => {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "number") return Number.isInteger(value) ? { integerValue: value } : { doubleValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toFirestoreValue) } };
  return { mapValue: { fields: toFirestoreFields(value) } };
};

const toFirestoreFields = (record) => Object.fromEntries(Object.entries(record).map(([key, value]) => [key, toFirestoreValue(value)]));

const fromFirestoreValue = (field) => {
  if ("stringValue" in field) return field.stringValue;
  if ("integerValue" in field) return Number(field.integerValue);
  if ("doubleValue" in field) return field.doubleValue;
  if ("booleanValue" in field) return field.booleanValue;
  if ("nullValue" in field) return null;
  if ("arrayValue" in field) return (field.arrayValue.values || []).map(fromFirestoreValue);
  if ("mapValue" in field) return fromFirestoreFields(field.mapValue.fields || {});
  return null;
};

const fromFirestoreFields = (fields) => Object.fromEntries(Object.entries(fields || {}).map(([key, value]) => [key, fromFirestoreValue(value)]));

const authHeaders = (idToken) => ({
  Authorization: `Bearer ${idToken}`,
  "Content-Type": "application/json",
});

const request = async (url, options, fallback) => {
  const response = await fetch(url, options);
  if (response.status === 404 && fallback !== undefined) return fallback;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || "雲端資料操作失敗");
  return data;
};

export const listDocs = async (session, collection) => {
  const url = `${firestoreBase()}/users/${session.localId}/${collection}?orderBy=updatedAt desc`;
  const data = await request(url, { headers: authHeaders(session.idToken) }, { documents: [] });
  return (data.documents || []).map((doc) => ({ id: doc.name.split("/").pop(), ...fromFirestoreFields(doc.fields) }));
};

export const saveDoc = async (session, collection, record) => {
  const id = record.id || crypto.randomUUID();
  const now = new Date().toISOString();
  const payload = { ...record, id, updatedAt: now, createdAt: record.createdAt || now };
  const url = `${firestoreBase()}/users/${session.localId}/${collection}/${id}`;
  await request(url, {
    method: "PATCH",
    headers: authHeaders(session.idToken),
    body: JSON.stringify({ fields: toFirestoreFields(payload) }),
  });
  return payload;
};

export const deleteDoc = async (session, collection, id) => {
  const url = `${firestoreBase()}/users/${session.localId}/${collection}/${id}`;
  await request(url, { method: "DELETE", headers: authHeaders(session.idToken) }, {});
};

export const getProfile = async (session) => {
  const url = `${firestoreBase()}/users/${session.localId}/profile/settings`;
  const data = await request(url, { headers: authHeaders(session.idToken) }, null);
  return data ? fromFirestoreFields(data.fields) : null;
};

export const saveProfile = async (session, profile) => {
  const now = new Date().toISOString();
  const url = `${firestoreBase()}/users/${session.localId}/profile/settings`;
  await request(url, {
    method: "PATCH",
    headers: authHeaders(session.idToken),
    body: JSON.stringify({ fields: toFirestoreFields({ ...profile, updatedAt: now }) }),
  });
};

export const askNimTutor = async ({ endpoint, apiKey, model, messages }) => {
  if (!endpoint || !apiKey || !model) throw new Error("請先在個人化設定中填入 NVIDIA NIM Endpoint、API Key 與模型名稱。");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, messages, temperature: 0.4, max_tokens: 900 }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || "NVIDIA NIM AI 導師回覆失敗");
  return data.choices?.[0]?.message?.content || "AI 導師沒有回傳內容。";
};
