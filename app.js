
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

const $ = (selector) => document.querySelector(selector);

let currentUser = null;
let currentProfile = null;
let activeConversationId = null;
let realtimeMessages = null;

// Tampilkan pesan status pada elemen HTML.
function notify(message) {
  const element = $("#status-message");

  if (element) {
    element.textContent = message;
  } else {
    alert(message);
  }
}

// Ambil sesi pengguna yang sedang login.
async function loadSession() {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    notify(error.message);
    return;
  }

  currentUser = data.session?.user ?? null;

  if (currentUser) {
    await loadProfile();
  }

  updateAuthUI();
  await loadProducts();
}

async function loadProfile() {
  if (!currentUser) return;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", currentUser.id)
    .maybeSingle();

  if (error) {
    console.error("Gagal memuat profil:", error.message);
    return;
  }

  currentProfile = data;
}

function updateAuthUI() {
  const userLabel = $("#user-label");
  const loginButton = $("#login-button");
  const logoutButton = $("#logout-button");
  const adminPanel = $("#admin-panel");

  if (userLabel) {
    userLabel.textContent = currentUser
      ? currentUser.email
      : "Belum login";
  }

  if (loginButton) {
    loginButton.hidden = Boolean(currentUser);
  }

  if (logoutButton) {
    logoutButton.hidden = !currentUser;
  }

  if (adminPanel) {
    adminPanel.hidden =
      currentProfile?.role !== "admin";
  }
}

// Daftar akun baru menggunakan email dan password.
async function signUp(email, password, displayName) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName
      }
    }
  });

  if (error) {
    notify(error.message);
    return;
  }

  notify(
    data.session
      ? "Pendaftaran berhasil!"
      : "Periksa email untuk konfirmasi akun."
  );
}

// Login menggunakan email dan password.
async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    notify(error.message);
    return;
  }

  notify("Login berhasil.");
}

// Login menggunakan Google OAuth.
async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin +
        window.location.pathname
    }
  });

  if (error) notify(error.message);
}

// Keluar dari akun.
async function signOut() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    notify(error.message);
    return;
  }

  currentUser = null;
  currentProfile = null;
  updateAuthUI();
  notify("Kamu sudah logout.");
}

// Memuat dan menampilkan katalog produk.
async function loadProducts() {
  const container = $("#product-list");
  if (!container) return;

  container.textContent = "Memuat produk...";

  const { data, error } = await supabase
    .from("products")
    .select("id, name, description, price, image_url, category")
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  if (error) {
    container.textContent = "Produk gagal dimuat.";
    console.error(error.message);
    return;
  }

  renderProducts(data ?? []);
}

function renderProducts(products) {
  const container = $("#product-list");
  if (!container) return;

  const search = ($("#product-search")?.value ?? "")
    .trim()
    .toLowerCase();

  const filtered = products.filter((product) =>
    `${product.name} ${product.description ?? ""} ${product.category ?? ""}`
      .toLowerCase()
      .includes(search)
  );

  container.replaceChildren();

  if (!filtered.length) {
    container.textContent = "Belum ada produk yang cocok.";
    return;
  }

  filtered.forEach((product) => {
    const card = document.createElement("article");
    card.className = "product-card";

    const image = document.createElement("img");
    image.src = product.image_url || "";
    image.alt = product.name;
    image.loading = "lazy";

    const title = document.createElement("h3");
    title.textContent = product.name;

    const description = document.createElement("p");
    description.textContent = product.description ?? "";

    const price = document.createElement("strong");
    price.textContent = new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0
    }).format(Number(product.price));

    const chatButton = document.createElement("button");
    chatButton.type = "button";
    chatButton.textContent = "Tanya / Beli";
    chatButton.addEventListener("click", () => {
      startConversation(product.id);
    });

    const whatsapp = document.createElement("a");
    whatsapp.href =
      "https://wa.me/6285120170736?text=" +
      encodeURIComponent(
        `Halo Madan Official Market, saya tertarik dengan ${product.name}.`
      );
    whatsapp.target = "_blank";
    whatsapp.rel = "noopener noreferrer";
    whatsapp.textContent = "Hubungi WhatsApp";

    card.append(image, title, description, price, chatButton, whatsapp);
    container.append(card);
  });
}

// Unggah foto ke Supabase Storage.
async function uploadProductImage(file) {
  if (!currentUser) {
    throw new Error("Login terlebih dahulu.");
  }

  if (!file || !file.type.startsWith("image/")) {
    throw new Error("Pilih file gambar yang valid.");
  }

  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp"
  ];

  if (!allowedTypes.includes(file.type)) {
    throw new Error("Gunakan gambar JPG, PNG, atau WebP.");
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Ukuran gambar maksimal 5 MB.");
  }

  const extension = file.type.split("/")[1].replace("jpeg", "jpg");
  const filePath =
    `${currentUser.id}/${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage
    .from("product-images")
    .upload(filePath, file, {
      contentType: file.type,
      upsert: false
    });

  if (error) throw error;

  const { data } = supabase.storage
    .from("product-images")
    .getPublicUrl(filePath);

  return data.publicUrl;
}

// Admin menambahkan produk baru.
async function addProduct(event) {
  event?.preventDefault();

  if (currentProfile?.role !== "admin") {
    notify("Hanya admin yang boleh menambahkan produk.");
    return;
  }

  const name = $("#product-name")?.value.trim();
  const description = $("#product-description")?.value.trim();
  const price = Number($("#product-price")?.value);
  const category = $("#product-category")?.value.trim() || "Lainnya";
  const file = $("#product-image")?.files?.[0];

  if (!name || !Number.isFinite(price) || price < 0 || !file) {
    notify("Isi nama, harga yang valid, dan pilih foto produk.");
    return;
  }

  try {
    notify("Mengunggah foto...");

    const imageUrl = await uploadProductImage(file);

    const { error } = await supabase.from("products").insert({
      name,
      description,
      price,
      category,
      image_url: imageUrl,
      created_by: currentUser.id,
      is_published: true
    });

    if (error) throw error;

    $("#product-form")?.reset();
    await loadProducts();
    notify("Produk berhasil diterbitkan!");
  } catch (error) {
    console.error(error);
    notify(`Gagal menambahkan produk: ${error.message}`);
  }
}

// Pelanggan membuka atau membuat percakapan dengan admin.
async function startConversation(productId = null) {
  if (!currentUser) {
    notify("Login terlebih dahulu untuk menggunakan chat.");
    return;
  }

  const { data: existing, error: findError } = await supabase
    .from("conversations")
    .select("id")
    .eq("customer_id", currentUser.id)
    .eq("status", "open")
    .limit(1)
    .maybeSingle();

  if (findError) {
    notify(findError.message);
    return;
  }

  if (existing) {
    activeConversationId = existing.id;
  } else {
    const { data, error } = await supabase
      .from("conversations")
      .insert({
        customer_id: currentUser.id,
        product_id: productId,
        status: "open"
      })
      .select("id")
      .single();

    if (error) {
      notify(error.message);
      return;
    }

    activeConversationId = data.id;
  }

  const chatPanel = $("#chat-panel");
  if (chatPanel) chatPanel.hidden = false;

  await loadMessages();
  subscribeToMessages();
}

// Memuat riwayat pesan percakapan aktif.
async function loadMessages() {
  if (!activeConversationId) return;

  const container = $("#chat-messages");
  if (!container) return;

  const { data, error } = await supabase
    .from("messages")
    .select("id, sender_id, body, created_at")
    .eq("conversation_id", activeConversationId)
    .order("created_at", { ascending: true });

  if (error) {
    notify(error.message);
    return;
  }

  container.replaceChildren();

  (data ?? []).forEach((message) => {
    const item = document.createElement("p");
    item.className =
      message.sender_id === currentUser?.id
        ? "chat-message mine"
        : "chat-message";

    item.textContent = message.body;
    container.append(item);
  });

  container.scrollTop = container.scrollHeight;
}

// Kirim pesan dalam chat.
async function sendMessage(event) {
  event?.preventDefault();

  const input = $("#chat-input");
  const body = input?.value.trim();

  if (!currentUser || !activeConversationId || !body) return;

  if (body.length > 2000) {
    notify("Pesan maksimal 2.000 karakter.");
    return;
  }

  const { error } = await supabase.from("messages").insert({
    conversation_id: activeConversationId,
    sender_id: currentUser.id,
    body
  });

  if (error) {
    notify(`Pesan gagal dikirim: ${error.message}`);
    return;
  }

  input.value = "";
  await loadMessages();
}

// Perbarui chat secara real-time jika Realtime diaktifkan di Supabase.
function subscribeToMessages() {
  if (!activeConversationId) return;

  if (realtimeMessages) {
    supabase.removeChannel(realtimeMessages);
  }

  realtimeMessages = supabase
    .channel(`chat-${activeConversationId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${activeConversationId}`
      },
      () => loadMessages()
    )
    .subscribe();
}

// Admin melihat daftar percakapan pelanggan.
async function loadAdminConversations() {
  if (currentProfile?.role !== "admin") {
    notify("Fitur ini hanya untuk admin.");
    return;
  }

  const container = $("#admin-conversations");
  if (!container) return;

  const { data, error } = await supabase
    .from("conversations")
    .select("id, customer_id, status, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    notify(error.message);
    return;
  }

  container.replaceChildren();

  (data ?? []).forEach((conversation) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent =
      `Percakapan ${conversation.customer_id.slice(0, 8)} — ${conversation.status}`;

    button.addEventListener("click", async () => {
      activeConversationId = conversation.id;

      const panel = $("#chat-panel");
      if (panel) panel.hidden = false;

      await loadMessages();
      subscribeToMessages();
    });

    container.append(button);
  });
}

// Hubungkan form dan tombol setelah DOM tersedia.
function bindUI() {
  $("#login-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();

    await signIn(
      $("#login-email")?.value.trim(),
      $("#login-password")?.value
    );
  });

  $("#signup-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();

    await signUp(
      $("#signup-email")?.value.trim(),
      $("#signup-password")?.value,
      $("#signup-name")?.value.trim()
    );
  });

  $("#google-login")?.addEventListener("click", signInWithGoogle);
  $("#logout-button")?.addEventListener("click", signOut);
  $("#product-form")?.addEventListener("submit", addProduct);
  $("#chat-form")?.addEventListener("submit", sendMessage);
  $("#admin-chat-refresh")?.addEventListener(
    "click",
    loadAdminConversations
  );

  $("#product-search")?.addEventListener("input", loadProducts);

  supabase.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user ?? null;

    // Hindari menjalankan permintaan Supabase langsung di callback auth.
    setTimeout(async () => {
      if (currentUser) await loadProfile();
      else currentProfile = null;

      updateAuthUI();
      await loadProducts();
    }, 0);
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  bindUI();
  await loadSession();
});
