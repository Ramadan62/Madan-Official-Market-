(() => {
  const $ = (s) => document.querySelector(s);
  const grid = $("#productGrid"), empty = $("#emptyState"), dialog = $("#adminDialog");
  const form = $("#productForm"), toast = $("#toast");
  let category = "Semua", search = "", sort = "newest";
  const localKey = "madan-market-local-products-v1";
  let localProducts = [];
  try { localProducts = JSON.parse(localStorage.getItem(localKey) || "[]"); } catch (_) {}
  const starterProducts = Array.isArray(window.MADAN_PRODUCTS) ? window.MADAN_PRODUCTS : [];
  const money = (n) => new Intl.NumberFormat("id-ID", {style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(n)||0);
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const allProducts = () => [...localProducts, ...starterProducts];
  function notify(message) {
    toast.textContent = message; toast.classList.add("show");
    clearTimeout(notify.timer); notify.timer = setTimeout(() => toast.classList.remove("show"), 3000);
  }
  function render() {
    let items = allProducts().filter(p => (category === "Semua" || p.category === category) &&
      `${p.name} ${p.description} ${p.category}`.toLowerCase().includes(search.toLowerCase()));
    if (sort === "low") items.sort((a,b) => Number(a.price)-Number(b.price));
    else if (sort === "high") items.sort((a,b) => Number(b.price)-Number(a.price));
    else items.sort((a,b) => new Date(b.createdAt || 0)-new Date(a.createdAt || 0));
    grid.innerHTML = items.map(p => {
      const img = p.image ? `<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'">` : "";
      const local = localProducts.some(lp => lp.id === p.id);
      const message = `Halo Madan Official Market, saya tertarik dengan produk "${p.name}" seharga ${money(p.price)}. Apakah masih tersedia?`;
      return `<article class="product-card">
        <div class="product-image">${img}<div class="product-placeholder" style="${p.image?'display:none':''}">✧</div><span class="product-category">${esc(p.category || "Lainnya")}</span></div>
        <div class="product-info"><h3>${esc(p.name)}</h3><p>${esc(p.description)}</p><div class="product-price">${money(p.price)} <small>/ produk</small></div>
        <div class="product-actions"><button class="primary-btn order-btn" data-message="${esc(message)}">Pesan via WA ↗</button>${local ? `<button class="delete-product" data-delete="${esc(p.id)}" aria-label="Hapus produk">×</button>` : ""}</div></div>
      </article>`;
    }).join("");
    empty.classList.toggle("hidden", items.length > 0);
    grid.classList.toggle("hidden", items.length === 0);
    grid.querySelectorAll(".order-btn").forEach(btn => btn.addEventListener("click", () => {
      const message = btn.dataset.message;
      const choice = window.prompt("Pilih nomor WhatsApp:\n1. 0851-2017-0736\n2. 0812-9276-6723\n\nKetik 1 atau 2");
      if (choice === "1") window.open("https://wa.me/6285120170736?text="+encodeURIComponent(message), "_blank", "noopener");
      else if (choice === "2") window.open("https://wa.me/6281292766723?text="+encodeURIComponent(message), "_blank", "noopener");
      else if (choice !== null) notify("Pilihan tidak dikenali. Silakan pilih 1 atau 2.");
    }));
    grid.querySelectorAll("[data-delete]").forEach(btn => btn.addEventListener("click", () => {
      if (!confirm("Hapus produk lokal ini dari browser?")) return;
      localProducts = localProducts.filter(p => p.id !== btn.dataset.delete);
      try { localStorage.setItem(localKey, JSON.stringify(localProducts)); } catch (_) {}
      render(); notify("Produk lokal dihapus.");
    }));
  }
  $("#searchInput").addEventListener("input", e => { search = e.target.value; render(); });
  $("#sortSelect").addEventListener("change", e => { sort = e.target.value; render(); });
  $("#categoryRow").querySelectorAll("[data-category]").forEach(btn => btn.addEventListener("click", () => {
    category = btn.dataset.category;
    $("#categoryRow").querySelectorAll(".chip").forEach(c => c.classList.toggle("active", c === btn));
    render();
  }));
  function openAdmin() { form.reset(); $("#formMessage").textContent = ""; dialog.showModal(); }
  $("#adminOpen").addEventListener("click", openAdmin);
  $("#emptyAdmin").addEventListener("click", openAdmin);
  $("#adminClose").addEventListener("click", () => dialog.close());
  $("#cancelAdmin").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", e => { if (e.target === dialog) dialog.close(); });
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const fd = new FormData(form);
    let image = String(fd.get("imageUrl") || "").trim();
    const file = fd.get("image");
    if (file && file.size) {
      if (!file.type.startsWith("image/")) { $("#formMessage").textContent = "Pilih file gambar yang valid."; return; }
      if (file.size > 1_500_000) { $("#formMessage").textContent = "Ukuran gambar maksimal 1,5 MB. Kompres gambar lalu coba lagi."; return; }
      image = await new Promise((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file);
      }).catch(() => "");
    }
    const product = { id:"local-"+Date.now()+"-"+Math.random().toString(36).slice(2,7), name:String(fd.get("name")).trim(),
      price:Number(fd.get("price")), category:String(fd.get("category")), description:String(fd.get("description")).trim(),
      image, createdAt:new Date().toISOString() };
    if (!product.name || !Number.isFinite(product.price) || product.price < 0 || !product.description) {
      $("#formMessage").textContent = "Periksa kembali nama, harga, dan deskripsi."; return;
    }
    localProducts.unshift(product);
    try { localStorage.setItem(localKey, JSON.stringify(localProducts)); }
    catch (_) { localProducts.shift(); $("#formMessage").textContent = "Penyimpanan browser penuh. Gunakan gambar lebih kecil atau URL gambar."; return; }
    dialog.close(); render(); notify("Produk tersimpan di browser ini.");
  });
  $("#year").textContent = new Date().getFullYear();
  render();
})();