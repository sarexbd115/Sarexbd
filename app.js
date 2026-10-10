const SUPABASE_URL = "https://kkjyhhxkdgcbtwysftjt.supabase.co";
const SUPABASE_KEY = "sb_publishable_FLYJFyWSJd2-_KVSy_ZMRA_cv9vRKs1";

// দোকানের সেটিংস — বদলাতে হলে শুধু এখানে বদলান
const SHOP_WHATSAPP = "8801610244533";
const DELIVERY = { dhaka: 80, outside: 120 };
const BD_PHONE = /^(?:\+?88)?01[3-9]\d{8}$/;

let supabaseClient = null;

if (window.supabase && SUPABASE_KEY) {
  supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );
}

/* PRODUCTS */
let products = [];
let visibleCount = 8;
let selectedProduct = null;
let selectedQuantity = 1;

const productsBox = document.getElementById("products");
const cartBox = document.getElementById("cart");
const deliveryArea = document.querySelector('[name="delivery_area"]');
const orderForm = document.getElementById("orderForm");
const message = document.getElementById("msg");

/* HELPERS */
function taka(value) {
  return "৳" + Number(value || 0).toLocaleString("en-BD");
}

function deliveryCharge() {
  return deliveryArea?.value === "outside"
    ? DELIVERY.outside
    : DELIVERY.dhaka;
}

// বাংলা অঙ্কে লেখা নম্বরকে ইংরেজি অঙ্কে বদলায়
function toEnglishDigits(text) {
  return String(text || "").replace(/[০-৯]/g, (d) => "০১২৩৪৫৬৭৮৯".indexOf(d));
}

function cleanPhone(text) {
  return toEnglishDigits(text).replace(/[\s\-().]/g, "");
}

// ডেলিভারির অপশনের লেখা উপরের DELIVERY থেকে বসায়, যাতে ভুল না মিলে
function setupDeliveryOptions() {
  if (!deliveryArea) return;

  Array.from(deliveryArea.options).forEach((option) => {
    if (option.value === "outside") {
      option.textContent = "Outside Dhaka — ৳" + DELIVERY.outside;
    } else if (option.value === "dhaka") {
      option.textContent = "Dhaka — ৳" + DELIVERY.dhaka;
    }
  });
}

/* LOAD PRODUCTS FROM SUPABASE */
async function loadProducts() {
  if (!productsBox) return;

  productsBox.textContent = "প্রোডাক্ট লোড হচ্ছে...";

  if (!supabaseClient) {
    productsBox.textContent = "ডেটাবেস সংযোগ পাওয়া যায়নি।";
    return;
  }

  const { data, error } = await supabaseClient
    .from("products")
    .select("id,name,description,price,image_url,stock,active")
    .eq("active", true)
    .gt("stock", 0)
    .order("id", { ascending: true });

  if (error) {
    console.error("Product loading error:", error.message);
    productsBox.textContent = "প্রোডাক্ট লোড করা যায়নি। পরে আবার চেষ্টা করুন।";
    return;
  }

  products = data || [];
  visibleCount = 8;
  selectedProduct = null;

  showProducts();
  updateCart();
}

/* SHOW PRODUCTS */
function showProducts() {
  if (!productsBox) return;

  productsBox.replaceChildren();

  if (products.length === 0) {
    productsBox.textContent = "এখনো কোনো প্রোডাক্ট পাওয়া যায়নি।";
    return;
  }

  products.slice(0, visibleCount).forEach((product) => {
    const card = document.createElement("div");
    card.className = "card product-card";

    const imageBox = document.createElement("div");
    imageBox.className = "photo product-image";

    if (product.image_url) {
      const img = document.createElement("img");
      img.src = product.image_url;
      img.alt = product.name;
      img.loading = "lazy";
      img.style.width = "100%";
      img.style.height = "100%";
      img.style.objectFit = "cover";

      img.onerror = () => {
        img.remove();
        imageBox.textContent = "SAREXBD";
      };

      imageBox.appendChild(img);
    } else {
      imageBox.textContent = "SAREXBD";
    }

    const title = document.createElement("h3");
    title.textContent = product.name;

    const price = document.createElement("p");
    price.textContent = taka(product.price);

    const buyButton = document.createElement("button");
    buyButton.type = "button";
    buyButton.className = "btn";
    buyButton.textContent = "Buy Now";
    buyButton.addEventListener("click", () => selectProduct(product.id));

    card.append(imageBox, title, price);

    if (product.description) {
      const description = document.createElement("p");
      description.textContent = product.description;
      card.appendChild(description);
    }

    card.appendChild(buyButton);
    productsBox.appendChild(card);
  });

  if (visibleCount < products.length) {
    const loadMore = document.createElement("button");
    loadMore.type = "button";
    loadMore.className = "btn";
    loadMore.textContent = "Load More";

    loadMore.addEventListener("click", () => {
      visibleCount += 8;
      showProducts();
    });

    productsBox.appendChild(loadMore);
  }
}

/* SELECT PRODUCT */
function selectProduct(productId) {
  selectedProduct = products.find(
    (product) => String(product.id) === String(productId)
  );

  if (!selectedProduct) return;

  selectedQuantity = 1;
  updateCart();

  document.getElementById("order")?.scrollIntoView({
    behavior: "smooth"
  });
}

function clampQuantity(value) {
  return Math.max(
    1,
    Math.min(
      Number(selectedProduct?.stock) || 1,
      Math.floor(Number(value) || 1)
    )
  );
}

/* UPDATE CART */
function updateCart() {
  if (!cartBox) return;

  if (!selectedProduct) {
    cartBox.textContent = "অর্ডার করতে একটি প্রোডাক্ট নির্বাচন করুন।";
    return;
  }

  const price = Number(selectedProduct.price);
  const charge = deliveryCharge();
  const subtotal = price * selectedQuantity;
  const total = subtotal + charge;

  cartBox.replaceChildren();

  const item = document.createElement("div");
  item.className = "cart-item";

  const title = document.createElement("strong");
  title.textContent = selectedProduct.name;

  const priceText = document.createElement("p");
  priceText.textContent = "দাম: " + taka(price);

  const quantityLabel = document.createElement("label");
  quantityLabel.htmlFor = "quantity";
  quantityLabel.textContent = "পরিমাণ";

  const quantityInput = document.createElement("input");
  quantityInput.type = "number";
  quantityInput.id = "quantity";
  quantityInput.min = "1";
  quantityInput.max = String(selectedProduct.stock);
  quantityInput.value = String(selectedQuantity);
  quantityInput.required = true;

  quantityInput.addEventListener("change", () => {
    selectedQuantity = clampQuantity(quantityInput.value);
    updateCart();
  });

  const subtotalText = document.createElement("p");
  subtotalText.textContent = "সাবটোটাল: " + taka(subtotal);

  const deliveryText = document.createElement("p");
  deliveryText.textContent = "ডেলিভারি: " + taka(charge);

  const totalText = document.createElement("h3");
  totalText.textContent = "সর্বমোট: " + taka(total);

  item.append(
    title,
    priceText,
    quantityLabel,
    quantityInput,
    subtotalText,
    deliveryText,
    totalText
  );

  cartBox.appendChild(item);
}

deliveryArea?.addEventListener("change", updateCart);

/* ORDER SUCCESS (WhatsApp নিশ্চিতকরণ বাটনসহ) */
function showOrderSuccess(summary) {
  if (!message) return;

  message.replaceChildren();
  message.append(
    "✅ আপনার অর্ডার সফলভাবে জমা হয়েছে! SAREXBD থেকে ফোনে যোগাযোগ করা হবে।"
  );

  const text = [
    "আসসালামু আলাইকুম, আমি SAREXBD-তে অর্ডার দিয়েছি।",
    "নাম: " + summary.name,
    "ফোন: " + summary.phone,
    "পণ্য: " + summary.product,
    "পরিমাণ: " + summary.quantity,
    "সর্বমোট: " + taka(summary.total)
  ].join("\n");

  const link = document.createElement("a");
  link.className = "btn";
  link.href =
    "https://wa.me/" + SHOP_WHATSAPP + "?text=" + encodeURIComponent(text);
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "WhatsApp-এ নিশ্চিত করুন";

  message.append(document.createElement("br"), link);
}

/* SUBMIT ORDER */
if (orderForm) {
  orderForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!selectedProduct) {
      message.textContent = "আগে একটি প্রোডাক্ট নির্বাচন করুন।";
      return;
    }

    // টাইপ করে সরাসরি Confirm চাপলেও যেন সঠিক পরিমাণ যায়
    const quantityInput = document.getElementById("quantity");
    if (quantityInput) {
      selectedQuantity = clampQuantity(quantityInput.value);
    }

    const formData = new FormData(orderForm);
    const customerName = String(
      formData.get("customer_name") || ""
    ).trim();
    const phone = cleanPhone(formData.get("phone"));
    const address = String(
      formData.get("address") || ""
    ).trim();

    if (!customerName || !phone || !address) {
      message.textContent = "নাম, ফোন ও ঠিকানা পূরণ করুন।";
      return;
    }

    if (!BD_PHONE.test(phone)) {
      message.textContent =
        "সঠিক মোবাইল নম্বর দিন (যেমন 01712345678)।";
      return;
    }

    if (address.length < 8) {
      message.textContent =
        "পুরো ঠিকানা লিখুন (এলাকা, থানা, জেলা)।";
      return;
    }

    if (selectedQuantity > Number(selectedProduct.stock)) {
      message.textContent = "এতগুলো পণ্য বর্তমানে স্টকে নেই।";
      return;
    }

    if (!supabaseClient) {
      message.textContent = "ডেটাবেস সংযোগ পাওয়া যায়নি।";
      return;
    }

    const deliveryText =
      deliveryArea?.value === "outside"
        ? "Outside Dhaka"
        : "Dhaka";

    const charge = deliveryCharge();
    const subtotal =
      Number(selectedProduct.price) * selectedQuantity;
    const total = subtotal + charge;

    const summary = {
      name: customerName,
      phone,
      product: selectedProduct.name,
      quantity: selectedQuantity,
      total
    };

    const submitButton = orderForm.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true; // দুইবার অর্ডার ঠেকাতে

    message.textContent = "অর্ডার জমা হচ্ছে...";

    try {
      const { error } = await supabaseClient
        .from("orders")
        .insert([{
          customer_name: customerName,
          phone,
          address,
          product: selectedProduct.name,
          quantity: String(selectedQuantity),
          "delivery area": deliveryText,
          subtotal,
          delivery_charge: charge,
          total,
          status: "Pending"
        }]);

      if (error) {
        console.error("Order error:", error.message);
        message.textContent =
          "অর্ডার জমা হয়নি। আবার চেষ্টা করুন।";
        return;
      }

      orderForm.reset();
      selectedProduct = null;
      selectedQuantity = 1;
      updateCart();
      showOrderSuccess(summary);
    } catch (err) {
      console.error("Order error:", err);
      message.textContent =
        "অর্ডার জমা হয়নি। নেট চেক করে আবার চেষ্টা করুন।";
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
}

/* CUSTOMER REVIEWS */
const reviewForm = document.getElementById("reviewForm");
const reviewsList = document.getElementById("reviewsList");
const reviewMsg = document.getElementById("reviewMsg");

async function loadReviews() {
  if (!reviewsList || !supabaseClient) return;

  const { data, error } = await supabaseClient
    .from("reviews")
    .select("reviewer_name,rating,review_text,created_at")
    .eq("status", "Approved")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Review loading error:", error.message);
    reviewsList.textContent = "রিভিউ লোড করা যায়নি।";
    return;
  }

  reviewsList.replaceChildren();

  if (!data || data.length === 0) {
    reviewsList.textContent = "এখনো কোনো অনুমোদিত রিভিউ নেই।";
    return;
  }

  data.forEach((review) => {
    const card = document.createElement("article");
    const name = document.createElement("h4");
    const stars = document.createElement("p");
    const content = document.createElement("p");

    // রেটিং ০-৫ এর মধ্যে সীমিত রাখা হয়েছে, যাতে ভুল ডেটায় তালিকা না ভাঙে
    const rating = Math.max(
      0,
      Math.min(5, Math.floor(Number(review.rating) || 0))
    );

    name.textContent = review.reviewer_name;
    stars.textContent = "★".repeat(rating) + "☆".repeat(5 - rating);
    content.textContent = review.review_text;

    card.append(name, stars, content);
    reviewsList.appendChild(card);
  });
}

if (reviewForm) {
  reviewForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!supabaseClient) {
      reviewMsg.textContent = "ডেটাবেস সংযোগ পাওয়া যায়নি।";
      return;
    }

    const formData = new FormData(reviewForm);
    const reviewer_name = String(
      formData.get("reviewer_name") || ""
    ).trim();
    const rating = Number(formData.get("rating"));
    const review_text = String(
      formData.get("review_text") || ""
    ).trim();

    if (
      !reviewer_name ||
      reviewer_name.length > 60 ||
      !Number.isInteger(rating) ||
      rating < 1 ||
      rating > 5 ||
      !review_text ||
      review_text.length > 1000
    ) {
      reviewMsg.textContent = "তথ্যগুলো ঠিকভাবে পূরণ করুন।";
      return;
    }

    const submitButton = reviewForm.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;

    reviewMsg.textContent = "রিভিউ জমা হচ্ছে...";

    try {
      const { error } = await supabaseClient
        .from("reviews")
        .insert([{
          reviewer_name,
          rating,
          review_text,
          status: "Pending"
        }]);

      if (error) {
        console.error("Review submission error:", error.message);
        reviewMsg.textContent =
          "রিভিউ জমা হয়নি। আবার চেষ্টা করুন।";
        return;
      }

      reviewMsg.textContent =
        "ধন্যবাদ! অনুমোদনের পর তোমার রিভিউ ওয়েবসাইটে দেখা যাবে।";

      reviewForm.reset();
    } catch (err) {
      console.error("Review submission error:", err);
      reviewMsg.textContent =
        "রিভিউ জমা হয়নি। নেট চেক করে আবার চেষ্টা করুন।";
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
}

/* START WEBSITE */
setupDeliveryOptions();
loadProducts();
loadReviews();
