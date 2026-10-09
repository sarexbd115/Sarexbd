const SUPABASE_URL = "https://kkjyhhxkdgcbtwysftjt.supabase.co";
const SUPABASE_KEY = "sb_publishable_FLYJFyWSJd2-_KVSy_ZMRA_cv9vRKs1";

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

/* LOAD PRODUCTS FROM SUPABASE */
async function loadProducts() {
  if (!productsBox) return;

  productsBox.textContent = "প্রোডাক্ট লোড হচ্ছে...";

  if (!supabaseClient) {
    productsBox.textContent = "ডেটাবেস সংযোগ পাওয়া যায়নি।";
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
    productsBox.textContent = "প্রোডাক্ট লোড করা যায়নি। পরে আবার চেষ্টা করুন।";
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
    productsBox.textContent = "এখনো কোনো প্রোডাক্ট পাওয়া যায়নি।";
    return;
  }

  products.slice(0, visibleCount).forEach((product) => {
    const card = document.createElement("div");
    card.className = "product-card";

    const imageBox = document.createElement("div");
    imageBox.className = "product-image";

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
    price.textContent =
      "৳" + Number(product.price).toLocaleString("en-BD");

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

/* UPDATE CART */
function updateCart() {
  if (!cartBox) return;

  if (!selectedProduct) {
    cartBox.textContent = "অর্ডার করতে একটি প্রোডাক্ট নির্বাচন করুন।";
    return;
  }

  const price = Number(selectedProduct.price);
  const deliveryCharge =
    deliveryArea?.value === "outside" ? 130 : 80;
  const subtotal = price * selectedQuantity;
  const total = subtotal + deliveryCharge;

  cartBox.replaceChildren();

  const item = document.createElement("div");
  item.className = "cart-item";

  const title = document.createElement("strong");
  title.textContent = selectedProduct.name;

  const priceText = document.createElement("p");
  priceText.textContent =
    "দাম: ৳" + price.toLocaleString("en-BD");

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
    selectedQuantity = Math.max(
      1,
      Math.min(
        Number(selectedProduct.stock) || 1,
        Math.floor(Number(quantityInput.value) || 1)
      )
    );
    updateCart();
  });

  const subtotalText = document.createElement("p");
  subtotalText.textContent =
    "সাবটোটাল: ৳" + subtotal.toLocaleString("en-BD");

  const deliveryText = document.createElement("p");
  deliveryText.textContent = "ডেলিভারি: ৳" + deliveryCharge;

  const totalText = document.createElement("h3");
  totalText.textContent =
    "সর্বমোট: ৳" + total.toLocaleString("en-BD");

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

/* SUBMIT ORDER */
if (orderForm) {
  orderForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!selectedProduct) {
      message.textContent = "আগে একটি প্রোডাক্ট নির্বাচন করুন।";
      return;
    }

    const formData = new FormData(orderForm);
    const customerName = String(
      formData.get("customer_name") || ""
    ).trim();
    const phone = String(formData.get("phone") || "").trim();
    const address = String(
      formData.get("address") || ""
    ).trim();

    if (!customerName || !phone || !address) {
      message.textContent = "নাম, ফোন ও ঠিকানা পূরণ করুন।";
      return;
    }

    if (selectedQuantity > Number(selectedProduct.stock)) {
      message.textContent = "এতগুলো পণ্য বর্তমানে স্টকে নেই।";
      return;
    }

    const deliveryText =
      deliveryArea?.value === "outside"
        ? "Outside Dhaka"
        : "Dhaka";

    const deliveryCharge =
      deliveryArea?.value === "outside" ? 130 : 80;

    const subtotal =
      Number(selectedProduct.price) * selectedQuantity;
    const total = subtotal + deliveryCharge;

    message.textContent = "অর্ডার জমা হচ্ছে...";

    if (!supabaseClient) {
      message.textContent = "ডেটাবেস সংযোগ পাওয়া যায়নি।";
      return;
    }

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
        delivery_charge: deliveryCharge,
        total,
        status: "Pending"
      }]);

    if (error) {
      console.error("Order error:", error.message);
      message.textContent =
        "অর্ডার জমা হয়নি। আবার চেষ্টা করুন।";
      return;
    }

    message.textContent =
      "✅ আপনার অর্ডার সফলভাবে জমা হয়েছে! SAREXBD থেকে ফোনে যোগাযোগ করা হবে।";

    orderForm.reset();
    selectedProduct = null;
    selectedQuantity = 1;
    updateCart();
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
    reviewsList.textContent = "রিভিউ লোড করা যায়নি।";
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

    name.textContent = review.reviewer_name;
    stars.textContent =
      "★".repeat(review.rating) + "☆".repeat(5 - review.rating);
    content.textContent = review.review_text;

    card.append(name, stars, content);
    reviewsList.appendChild(card);
  });
}

if (reviewForm) {
  reviewForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!supabaseClient) {
      reviewMsg.textContent = "ডেটাবেস সংযোগ পাওয়া যায়নি।";
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

    reviewMsg.textContent = "রিভিউ জমা হচ্ছে...";

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
        "রিভিউ জমা হয়নি। আবার চেষ্টা করুন।";
      return;
    }

    reviewMsg.textContent =
      "ধন্যবাদ! অনুমোদনের পর তোমার রিভিউ ওয়েবসাইটে দেখা যাবে।";

    reviewForm.reset();
  });
}

/* START WEBSITE */
loadProducts();
loadReviews();
