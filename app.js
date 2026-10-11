const SUPABASE_URL = "https://kkjyhhxkdgcbtwysftjt.supabase.co";
const SUPABASE_KEY = "sb_publishable_FLYJFyWSJd2-_KVSy_ZMRA_cv9vRKs1";

// দোকানের সেটিংস
const SHOP_WHATSAPP = "8801610244533";
// ডেলিভারি চার্জ সার্ভার (shop_settings টেবিল) থেকে আসে; এখানকার মান শুধু ব্যাকআপ
const DELIVERY = { dhaka: 80, outside: 120 };
const BD_PHONE = /^(?:\+?88)?01[3-9]\d{8}$/;
const MAX_QUANTITY = 50;

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

// কুপন (সার্ভারে যাচাই হয়; এখানে শুধু দেখানোর জন্য)
let appliedCoupon = null;
let couponInput = null;
let couponMsg = null;

const productsBox = document.getElementById("products");
const cartBox = document.getElementById("cart");
const deliveryArea = document.querySelector('[name="delivery_area"]');
const orderForm = document.getElementById("orderForm");
const message = document.getElementById("msg");

/* HELPERS */
function taka(value) {
  return "৳" + Number(value || 0).toLocaleString("en-BD");
}

// প্রোডাক্ট ছাড়ের পরের একক দাম (সার্ভারের হিসাবের সাথে মেলানো)
function unitPrice(product) {
  const price = Number(product.price) || 0;
  const percent = Number(product.discount_percent) || 0;
  return percent > 0 ? Math.round((price * (100 - percent)) / 100) : price;
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

// ডেলিভারির অপশনের লেখা DELIVERY থেকে বসায়
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

// সার্ভার থেকে বর্তমান ডেলিভারি চার্জ আনে
async function loadDeliveryCharges() {
  if (!supabaseClient) return;

  const { data, error } = await supabaseClient.rpc("get_delivery_charges");

  if (error || !data) {
    console.warn("Delivery charge loading skipped:", error?.message);
    return;
  }

  const dhaka = Number(data.dhaka);
  const outside = Number(data.outside);

  if (Number.isFinite(dhaka) && dhaka >= 0) DELIVERY.dhaka = dhaka;
  if (Number.isFinite(outside) && outside >= 0) DELIVERY.outside = outside;

  setupDeliveryOptions();
  updateCart();
}

/* COUPON */
function setupCouponUI() {
  if (!cartBox || !orderForm) return;

  const wrap = document.createElement("div");

  const label = document.createElement("label");
  label.htmlFor = "couponCode";
  label.textContent = "Coupon code (optional)";

  couponInput = document.createElement("input");
  couponInput.id = "couponCode";
  couponInput.name = "coupon";
  couponInput.type = "text";
  couponInput.placeholder = "e.g. SAREXBD5";
  couponInput.maxLength = 30;
  couponInput.autocomplete = "off";
  couponInput.autocapitalize = "characters";

  const applyButton = document.createElement("button");
  applyButton.type = "button";
  applyButton.className = "btn";
  applyButton.textContent = "Apply Coupon";
  applyButton.addEventListener("click", () => applyCoupon(applyButton));

  couponMsg = document.createElement("p");
  couponMsg.setAttribute("role", "status");

  // কোড বদলালে আগের যাচাই বাতিল হয়
  couponInput.addEventListener("input", () => {
    appliedCoupon = null;
    couponMsg.textContent = "";
    updateCart();
  });

  wrap.append(label, couponInput, applyButton, couponMsg);
  cartBox.before(wrap);
}

async function applyCoupon(button) {
  const code = couponInput.value.trim();

  if (!code) {
    couponMsg.textContent = "কুপন কোড লিখুন।";
    return;
  }

  if (!supabaseClient) {
    couponMsg.textContent = "ডেটাবেস সংযোগ পাওয়া যায়নি।";
    return;
  }

  button.disabled = true;
  couponMsg.textContent = "কুপন যাচাই হচ্ছে...";

  try {
    const { data, error } = await supabaseClient.rpc("check_coupon", {
      p_code: code
    });

    if (error) {
      console.error("Coupon error:", error.message);
      appliedCoupon = null;
      couponMsg.textContent = "কুপন যাচাই করা যায়নি। আবার চেষ্টা করুন।";
    } else if (!data?.valid) {
      appliedCoupon = null;
      couponMsg.textContent = "কুপন কোডটি সঠিক নয় বা মেয়াদ শেষ।";
    } else {
      appliedCoupon = {
        code: data.code,
        percent: Number(data.percent)
      };
      couponMsg.textContent =
        "✅ কুপন প্রযোজ্য: " + appliedCoupon.percent + "% ছাড়";
    }
  } finally {
    button.disabled = false;
    updateCart();
  }
}

/* LOAD PRODUCTS FROM SUPABASE */
async function loadProducts(silent = false) {
  if (!productsBox) return;

  if (!silent) productsBox.textContent = "প্রোডাক্ট লোড হচ্ছে...";

  if (!supabaseClient) {
    productsBox.textContent = "ডেটাবেস সংযোগ পাওয়া যায়নি।";
    return;
  }

  const { data, error } = await supabaseClient
    .from("products")
    .select("id,name,description,price,discount_percent,image_url,stock,active")
    .eq("active", true)
    .gt("stock", 0)
    .order("id", { ascending: true });

  if (error) {
    console.error("Product loading error:", error.message);
    productsBox.textContent = "প্রোডাক্ট লোড করা যায়নি। পরে আবার চেষ্টা করুন।";
    return;
  }

  products = data || [];
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

    // দাম: ছাড় থাকলে নতুন দাম, পাশে কাটা দাগে পুরনো দাম ও ব্যাজ
    const percentOff = Number(product.discount_percent) || 0;
    const price = document.createElement("p");

    if (percentOff > 0) {
      price.append(taka(unitPrice(product)));

      const oldPrice = document.createElement("s");
      oldPrice.textContent = taka(product.price);
      oldPrice.style.cssText =
        "opacity:.6;font-size:.7em;font-weight:400;margin-left:6px";
      price.appendChild(oldPrice);

      const badge = document.createElement("span");
      badge.className = "discount-badge";
      badge.textContent = "-" + percentOff + "%";
      card.appendChild(badge);
    } else {
      price.textContent = taka(product.price);
    }

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
  const limit = Math.min(
    Number(selectedProduct?.stock) || 1,
    MAX_QUANTITY
  );

  return Math.max(1, Math.min(limit, Math.floor(Number(value) || 1)));
}

/* UPDATE CART (শুধু দেখানোর জন্য; আসল দাম সার্ভারে হিসাব হয়) */
function updateCart() {
  if (!cartBox) return;

  if (!selectedProduct) {
    cartBox.textContent = "অর্ডার করতে একটি প্রোডাক্ট নির্বাচন করুন।";
    return;
  }

  const percentOff = Number(selectedProduct.discount_percent) || 0;
  const price = unitPrice(selectedProduct);
  const charge = deliveryCharge();
  const subtotal = price * selectedQuantity;
  const discount = appliedCoupon
    ? Math.round((subtotal * appliedCoupon.percent) / 100)
    : 0;
  const total = subtotal - discount + charge;

  cartBox.replaceChildren();

  const item = document.createElement("div");
  item.className = "cart-item";

  const title = document.createElement("strong");
  title.textContent = selectedProduct.name;

  const priceText = document.createElement("p");
  priceText.textContent =
    percentOff > 0
      ? "দাম: " +
        taka(price) +
        " (মূল " +
        taka(selectedProduct.price) +
        ", −" +
        percentOff +
        "%)"
      : "দাম: " + taka(price);

  const quantityLabel = document.createElement("label");
  quantityLabel.htmlFor = "quantity";
  quantityLabel.textContent = "পরিমাণ";

  const quantityInput = document.createElement("input");
  quantityInput.type = "number";
  quantityInput.id = "quantity";
  quantityInput.min = "1";
  quantityInput.max = String(
    Math.min(Number(selectedProduct.stock) || 1, MAX_QUANTITY)
  );
  quantityInput.value = String(selectedQuantity);
  quantityInput.required = true;

  quantityInput.addEventListener("change", () => {
    selectedQuantity = clampQuantity(quantityInput.value);
    updateCart();
  });

  const subtotalText = document.createElement("p");
  subtotalText.textContent = "সাবটোটাল: " + taka(subtotal);

  item.append(
    title,
    priceText,
    quantityLabel,
    quantityInput,
    subtotalText
  );

  if (discount > 0) {
    const discountText = document.createElement("p");
    discountText.textContent =
      "কুপন ছাড় (" + appliedCoupon.code + "): −" + taka(discount);
    item.appendChild(discountText);
  }

  const deliveryText = document.createElement("p");
  deliveryText.textContent = "ডেলিভারি: " + taka(charge);

  const totalText = document.createElement("h3");
  totalText.textContent = "সর্বমোট: " + taka(total);

  item.append(deliveryText, totalText);

  cartBox.appendChild(item);
}

deliveryArea?.addEventListener("change", updateCart);

/* ORDER SUCCESS (অর্ডার নম্বর ও WhatsApp বাটনসহ) */
function showOrderSuccess(summary) {
  if (!message) return;

  message.replaceChildren();
  message.append(
    "✅ আপনার অর্ডার সফলভাবে জমা হয়েছে!" +
      (summary.orderId ? " অর্ডার নম্বর: #" + summary.orderId + "।" : "") +
      " SAREXBD থেকে ফোনে যোগাযোগ করা হবে।"
  );

  const lines = [
    "আসসালামু আলাইকুম, আমি SAREXBD-তে অর্ডার দিয়েছি।"
  ];

  if (summary.orderId) lines.push("অর্ডার নম্বর: #" + summary.orderId);

  lines.push(
    "নাম: " + summary.name,
    "ফোন: " + summary.phone,
    "পণ্য: " + summary.product,
    "পরিমাণ: " + summary.quantity
  );

  if (summary.discount > 0) {
    lines.push(
      "কুপন (" + summary.coupon + "): −" + taka(summary.discount)
    );
  }

  lines.push("সর্বমোট: " + taka(summary.total));

  const link = document.createElement("a");
  link.className = "btn";
  link.href =
    "https://wa.me/" +
    SHOP_WHATSAPP +
    "?text=" +
    encodeURIComponent(lines.join("\n"));
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "WhatsApp-এ নিশ্চিত করুন";

  message.append(document.createElement("br"), link);
}

// সার্ভারের এরর কোডকে বাংলা বার্তায় বদলায়
function orderErrorMessage(error) {
  const text = String(error?.message || "");

  if (text.includes("out_of_stock")) {
    return "দুঃখিত, এই পণ্যের এতগুলো স্টকে নেই। পরিমাণ কমিয়ে আবার চেষ্টা করুন।";
  }
  if (text.includes("product_unavailable")) {
    return "দুঃখিত, প্রোডাক্টটি এখন পাওয়া যাচ্ছে না।";
  }
  if (text.includes("too_many_orders")) {
    return "অল্প সময়ে অনেকগুলো অর্ডার হয়েছে। কিছুক্ষণ পরে চেষ্টা করুন বা WhatsApp-এ জানান।";
  }
  if (text.includes("invalid_coupon")) {
    return "কুপন কোডটি সঠিক নয় বা মেয়াদ শেষ। কোডটি মুছে বা ঠিক করে আবার চেষ্টা করুন।";
  }
  if (text.includes("coupon_used")) {
    return "এই ফোন নম্বরে কুপনটি আগেই ব্যবহার করা হয়েছে।";
  }
  if (text.includes("invalid_input")) {
    return "তথ্য ঠিক নেই। নাম, ফোন ও ঠিকানা আবার দেখুন।";
  }

  return "অর্ডার জমা হয়নি। আবার চেষ্টা করুন।";
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

    const area = deliveryArea?.value === "outside" ? "outside" : "dhaka";
    const couponText = couponInput ? couponInput.value.trim() : "";

    const subtotalEstimate =
      unitPrice(selectedProduct) * selectedQuantity;
    const discountEstimate = appliedCoupon
      ? Math.round((subtotalEstimate * appliedCoupon.percent) / 100)
      : 0;

    const summary = {
      name: customerName,
      phone,
      product: selectedProduct.name,
      quantity: selectedQuantity,
      total: subtotalEstimate - discountEstimate + deliveryCharge(),
      discount: discountEstimate,
      coupon: appliedCoupon ? appliedCoupon.code : "",
      orderId: ""
    };

    const submitButton = orderForm.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true; // দুইবার অর্ডার ঠেকাতে

    message.textContent = "অর্ডার জমা হচ্ছে...";

    try {
      // দাম, ছাড়, ডেলিভারি ও স্টক সার্ভারে যাচাই হয়; ব্রাউজারের হিসাব ব্যবহার হয় না
      const { data, error } = await supabaseClient.rpc("place_order", {
        p_name: customerName,
        p_phone: phone,
        p_address: address,
        p_product_id: String(selectedProduct.id),
        p_quantity: selectedQuantity,
        p_area: area,
        p_coupon: couponText || null
      });

      if (error) {
        console.error("Order error:", error.message);
        message.textContent = orderErrorMessage(error);

        if (/out_of_stock|product_unavailable/.test(error.message || "")) {
          await loadProducts(true);
        }
        return;
      }

      const result = data || {};
      summary.orderId = result.order_id || "";
      summary.total = Number(result.total) || summary.total;
      summary.discount = Number(result.discount) || 0;
      summary.coupon = result.coupon || summary.coupon;

      orderForm.reset();
      selectedProduct = null;
      selectedQuantity = 1;
      appliedCoupon = null;
      if (couponMsg) couponMsg.textContent = "";
      updateCart();
      showOrderSuccess(summary);
      await loadProducts(true); // স্টক বদলেছে, তাই তালিকা নতুন করে আনা
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

/* PRODUCT GRID STYLE: মোবাইলে ২টা, বড় স্ক্রিনে ৩টা করে প্রোডাক্ট */
(function () {
  const style = document.createElement("style");
  style.textContent = `
#products.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
#products .product-card{position:relative;min-width:0;padding:10px;display:flex;flex-direction:column}
#products .product-image{height:auto;aspect-ratio:1/1;margin-bottom:10px;overflow:hidden}
#products .product-card h3{font-size:15px;line-height:1.3;margin:4px 0;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
#products .product-card p{font-size:13px;margin:4px 0}
#products .product-card h3+p{font-size:17px;font-weight:700}
#products .product-card h3+p~p{font-size:12px;opacity:.85;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
#products .product-card p:last-of-type{margin-bottom:10px}
#products .product-card .btn{margin-top:auto;width:100%;padding:9px 8px;font-size:14px}
#products .discount-badge{position:absolute;top:16px;left:16px;z-index:2;background:#d4af37;color:#090909;font-weight:700;font-size:12px;padding:2px 8px;border-radius:99px}
#products>.btn{grid-column:1/-1}
@media(min-width:700px){
#products.grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}
#products .product-card{padding:14px}
#products .discount-badge{top:20px;left:20px}
}`;
  document.head.appendChild(style);
})();

/* START WEBSITE */
setupCouponUI();
setupDeliveryOptions();
loadDeliveryCharges();
loadProducts();
loadReviews();
/* HOME HIGHLIGHTS: অফার ব্যানার, ভরসার ঘর ও ডেলিভারি নোট */
(function () {
  const OFFER_CODE = "SAREXBD5";
  let couponPercent = 0;

  const hero = document.getElementById("home");
  if (!hero) return;

  const style = document.createElement("style");
  style.textContent = `
#home.hero{min-height:0!important;padding-top:56px!important;padding-bottom:36px!important}
#highlights{max-width:1100px;margin:0 auto;padding:18px 6% 0}
#highlights .offer-bar{border:1px dashed #d4af37;border-radius:12px;padding:12px 14px;background:rgba(212,175,55,.08);text-align:center;margin-bottom:14px}
#highlights .offer-bar p{margin:4px 0;font-size:14px}
#highlights .offer-bar b{color:#d4af37}
#highlights .copy-code{background:#d4af37;color:#090909;border:0;border-radius:6px;padding:4px 10px;font-weight:700;cursor:pointer;margin-left:8px}
#highlights .trust{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
#highlights .trust-item{border:1px solid #332a16;background:#101010;border-radius:12px;padding:12px 8px;text-align:center;font-size:12px;line-height:1.35;color:#ddd;text-decoration:none}
#highlights .trust-item span{display:block;font-size:22px}
#highlights .trust-item strong{display:block;font-size:13px;margin:4px 0 2px;color:#fff}
#highlights .delivery-note{color:#999;font-size:12px;text-align:center;margin:10px 0 0}`;
  document.head.appendChild(style);

  const section = document.createElement("section");
  section.id = "highlights";
  section.innerHTML = `
<div class="offer-bar" hidden>
  <p class="offer-product" hidden></p>
  <p class="offer-coupon" hidden></p>
</div>
<div class="trust">
  <div class="trust-item"><span>🧵</span><strong>জেনুইন লেদার</strong>আসল চামড়ার পণ্য</div>
  <div class="trust-item"><span>🚚</span><strong>ডেলিভারি</strong>ঢাকার ভেতরে ও বাইরে</div>
  <a class="trust-item" href="https://wa.me/${SHOP_WHATSAPP}" target="_blank" rel="noopener noreferrer"><span>💬</span><strong>সরাসরি সহায়তা</strong>WhatsApp-এ জানান</a>
</div>
<p class="delivery-note">ডেলিভারির সময় পণ্যভেদে আলাদা হয়। যেমন জ্যাকেটে প্রায় ১০ দিন লাগে।</p>`;
  hero.after(section);

  const bar = section.querySelector(".offer-bar");
  const productLine = section.querySelector(".offer-product");
  const couponLine = section.querySelector(".offer-coupon");

  function setOffers() {
    const maxOff = Math.max(
      0,
      ...products.map((p) => Number(p.discount_percent) || 0)
    );

    productLine.hidden = maxOff <= 0;
    productLine.textContent =
      maxOff > 0 ? "🔥 ছাড় চলছে: সর্বোচ্চ " + maxOff + "% পর্যন্ত" : "";

    couponLine.hidden = couponPercent <= 0;
    bar.hidden = maxOff <= 0 && couponPercent <= 0;
  }

  function buildCouponLine() {
    couponLine.textContent = "";
    couponLine.append("কুপন কোড ");

    const code = document.createElement("b");
    code.textContent = OFFER_CODE;

    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "copy-code";
    copy.textContent = "কপি";
    copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(OFFER_CODE);
        copy.textContent = "কপি হয়েছে ✓";
      } catch (e) {
        copy.textContent = "কোড: " + OFFER_CODE;
      }
      setTimeout(() => {
        copy.textContent = "কপি";
      }, 2000);
    });

    couponLine.append(
      code,
      " দিলে অতিরিক্ত " + couponPercent + "% ছাড়",
      copy
    );
  }

  // প্রোডাক্ট তালিকা দেখানোর পর অফার ব্যানার নতুন করে হিসাব করে
  const originalShowProducts = showProducts;
  showProducts = function () {
    originalShowProducts();
    setOffers();
  };

  async function loadOffer() {
    if (!supabaseClient) return;

    const { data, error } = await supabaseClient.rpc("check_coupon", {
      p_code: OFFER_CODE
    });

    if (!error && data?.valid) {
      couponPercent = Number(data.percent) || 0;
      buildCouponLine();
      setOffers();
    }
  }

  loadOffer();
})();

/* ABOUT যোগাযোগ বাটন, ফুটার ও অর্ডার ফর্মের ছোট উন্নতি */
(function () {
  const FACEBOOK_URL =
    "https://www.facebook.com/profile.php?id=100087606876298";

  const style = document.createElement("style");
  style.textContent = `
#about .contact-buttons{display:flex;flex-wrap:wrap;justify-content:center;gap:10px;margin-top:18px}
#about .contact-buttons .btn{margin:0;text-decoration:none}
#about .contact-buttons .btn.alt{background:transparent;color:#d4af37;border:1px solid #d4af37}
#about .contact-note{text-align:center;color:#999;font-size:13px;margin:12px 0 0}
footer a{color:#d4af37}
#cart{margin:10px 0 14px;line-height:1.6;color:#bbb}
#cart .cart-item{color:#eee}
#orderForm button[type="submit"]{margin-top:6px}`;
  document.head.appendChild(style);

  const about = document.getElementById("about");

  if (about && !document.getElementById("contactButtons")) {
    const wrap = document.createElement("div");
    wrap.id = "contactButtons";
    wrap.className = "contact-buttons";

    const wa = document.createElement("a");
    wa.className = "btn";
    wa.href = "https://wa.me/" + SHOP_WHATSAPP;
    wa.target = "_blank";
    wa.rel = "noopener noreferrer";
    wa.textContent = "WhatsApp-এ মেসেজ করুন";

    const fb = document.createElement("a");
    fb.className = "btn alt";
    fb.href = FACEBOOK_URL;
    fb.target = "_blank";
    fb.rel = "noopener noreferrer";
    fb.textContent = "Facebook পেজ";

    wrap.append(wa, fb);
    about.appendChild(wrap);

    const note = document.createElement("p");
    note.className = "contact-note";
    note.textContent =
      "অর্ডার বা পণ্য নিয়ে প্রশ্নে যোগাযোগ করুন: " +
      SHOP_WHATSAPP.replace(/^88/, "");
    about.appendChild(note);
  }

  const footer = document.querySelector("footer");

  if (footer) {
    const fbLink = document.createElement("a");
    fbLink.href = FACEBOOK_URL;
    fbLink.target = "_blank";
    fbLink.rel = "noopener noreferrer";
    fbLink.textContent = "Facebook";
    footer.append(" · ", fbLink);
  }
})();
/* PRIVATE COUPON: কুপন ঘরে কোনো কোড দেখাবে না */
(function () {
  const input = document.getElementById("couponCode");
  if (input) input.placeholder = "Enter your coupon code";
})();
/* CATEGORY FILTER: ক্যাটাগরি অনুযায়ী প্রোডাক্ট দেখানো */
(function () {
  if (!productsBox || !supabaseClient) return;

  let activeCategory = "";
  let allProducts = [];
  let lastShown = null;
  const categoryById = {};

  const style = document.createElement("style");
  style.textContent = `
#categoryBar{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin:0 0 18px}
#categoryBar button{background:transparent;color:#d4af37;border:1px solid #d4af37;border-radius:99px;padding:7px 14px;font-size:14px;font-weight:600;cursor:pointer}
#categoryBar button.active{background:#d4af37;color:#090909}`;
  document.head.appendChild(style);

  const bar = document.createElement("div");
  bar.id = "categoryBar";
  bar.hidden = true;
  productsBox.before(bar);

  function renderBar() {
    const names = [
      ...new Set(allProducts.map((p) => p.category).filter(Boolean))
    ];

    bar.replaceChildren();
    bar.hidden = names.length < 2;
    if (names.length < 2) return;

    ["", ...names].forEach((name) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = name || "All";
      if (name === activeCategory) button.className = "active";

      button.addEventListener("click", () => {
        activeCategory = name;
        visibleCount = 8;
        showProducts();
      });

      bar.appendChild(button);
    });
  }

  const originalShowProducts = showProducts;

  showProducts = function () {
    if (products !== lastShown) allProducts = products; // নতুন তালিকা এলে

    allProducts.forEach((p) => {
      p.category = categoryById[String(p.id)] || "";
    });

    if (
      activeCategory &&
      !allProducts.some((p) => p.category === activeCategory)
    ) {
      activeCategory = "";
    }

    const visible = activeCategory
      ? allProducts.filter((p) => p.category === activeCategory)
      : allProducts;

    lastShown = visible;
    products = visible;

    originalShowProducts();
    renderBar();
  };

  async function loadCategories() {
    const { data, error } = await supabaseClient
      .from("products")
      .select("id,category")
      .eq("active", true);

    if (error || !data) {
      console.warn("Category loading skipped:", error?.message);
      return;
    }

    data.forEach((row) => {
      categoryById[String(row.id)] = row.category || "";
    });

    if (products.length) showProducts();
  }

  loadCategories();
})();
