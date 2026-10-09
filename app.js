const SUPABASE_URL = "https://kkjyhhxkdgcbtwysftjt.supabase.co";

// তোমার নিজের Supabase Publishable Key এখানে রাখবে
const SUPABASE_KEY = "sb_publishable_FLYJFyWSJd2-_KVSy_ZMRA_cv9vRKs1";

let supabaseClient = null;

if (window.supabase && SUPABASE_KEY !== "PASTE_YOUR_KEY_HERE") {
  supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );
}


/* =========================
   PRODUCTS
========================= */

  let products = [];
let selectedProduct = null;
let selectedQuantity = 1;

/* =========================
   ELEMENTS
========================= */

const productsBox = document.getElementById("products");
const cartBox = document.getElementById("cart");
const deliveryArea = document.querySelector(
  '[name="delivery_area"]'
);
const orderForm = document.getElementById("orderForm");
const message = document.getElementById("msg");


/* =========================
   SHOW PRODUCTS
========================= */

function showProducts() {

  productsBox.innerHTML = "";

  products.forEach((product, index) => {

    const card = document.createElement("div");

    card.className = "product-card";

    card.innerHTML = `
      <div class="product-image">
        <div class="product-placeholder">
          SAREXBD
        </div>
      </div>

      <h3>${product.name}</h3>

      <p>
        ৳${product.price.toLocaleString()}
      </p>

      <button
        type="button"
        class="btn"
        onclick="selectProduct(${index})"
      >
        Buy Now
      </button>
    `;

    productsBox.appendChild(card);

  });

}


/* =========================
   SELECT PRODUCT
========================= */

function selectProduct(index) {

  selectedProduct = products[index];

  selectedQuantity = 1;

  updateCart();

  document.getElementById("order").scrollIntoView({
    behavior: "smooth"
  });

}


/* =========================
   UPDATE CART
========================= */

function updateCart() {

  if (!selectedProduct) {
    cartBox.innerHTML = "";
    return;
  }

  const deliveryCharge =
    deliveryArea.value === "outside"
      ? 130
      : 80;

  const subtotal =
    selectedProduct.price * selectedQuantity;

  const total =
    subtotal + deliveryCharge;


  cartBox.innerHTML = `

    <div class="cart-item">

      <strong>
        ${selectedProduct.name}
      </strong>

      <p>
        Price:
        ৳${selectedProduct.price.toLocaleString()}
      </p>

      <label>
        Quantity
      </label>

      <input
        type="number"
        id="quantity"
        min="1"
        value="${selectedQuantity}"
      >

      <p>
        Subtotal:
        ৳${subtotal.toLocaleString()}
      </p>

      <p>
        Delivery:
        ৳${deliveryCharge}
      </p>

      <h3>
        Total:
        ৳${total.toLocaleString()}
      </h3>

    </div>

  `;


  const quantityInput =
    document.getElementById("quantity");


  quantityInput.addEventListener(
    "input",
    function () {

      selectedQuantity =
        Math.max(
          1,
          Number(this.value) || 1
        );

      updateCart();

    }
  );

}


/* =========================
   DELIVERY CHANGE
========================= */

deliveryArea.addEventListener(
  "change",
  updateCart
);


/* =========================
   ORDER SUBMIT
========================= */

orderForm.addEventListener(
  "submit",
  async function (event) {

    event.preventDefault();


    if (!selectedProduct) {

      message.textContent =
        "Please select a product first.";

      return;

    }


    const formData =
      new FormData(orderForm);


    const customerName =
      formData.get("customer_name");

    const phone =
      formData.get("phone");

    const address =
      formData.get("address");


    const deliveryCharge =
      deliveryArea.value === "outside"
        ? 130
        : 80;


    const subtotal =
      selectedProduct.price *
      selectedQuantity;


    const total =
      subtotal + deliveryCharge;


    const deliveryText =
      deliveryArea.value === "outside"
        ? "Outside Dhaka"
        : "Dhaka";


    /* =========================
       SAVE TO SUPABASE
    ========================= */

    if (supabaseClient) {

      const { error } =
        await supabaseClient
          .from("orders")
          .insert([
            {
              customer_name:
                customerName,

              phone:
                phone,

              address:
                address,

              product:
                selectedProduct.name,

              quantity:
                String(selectedQuantity),

              "delivery area":
                deliveryText,

              subtotal:
                subtotal,

              delivery_charge:
                deliveryCharge,

              total:
                total,

              status:
                "Pending"
            }
          ]);


      if (error) {

        console.error(
          "Supabase error:",
          error
        );

        message.textContent = "Order save হয়নি: " + error.message;

        return;

      }

    }


    /* =========================
       WHATSAPP ORDER
    ========================= */

    const whatsappMessage = `

SAREXBD ORDER

Customer: ${customerName}

Phone: ${phone}

Address: ${address}

Product: ${selectedProduct.name}

Quantity: ${selectedQuantity}

Subtotal: ৳${subtotal}

Delivery: ৳${deliveryCharge}

Total: ৳${total}

Delivery Area: ${deliveryText}

`;


    const whatsappURL =
      "https://wa.me/8801610244533?text=" +
      encodeURIComponent(
        whatsappMessage
      );


    message.textContent =
      "Order received. WhatsApp খুলছে...";


    
/* ORDER SUCCESS — NO WHATSAPP REQUIRED */

message.textContent =
  "✅ আপনার অর্ডার সফলভাবে জমা হয়েছে! SAREXBD থেকে ফোনে যোগাযোগ করা হবে।";

orderForm.reset();

selectedProduct = null;
selectedQuantity = 1;

cartBox.innerHTML =
  "<p>নতুন অর্ডার করতে একটি পণ্য নির্বাচন করুন।</p>";


  }
);


/* =========================
   START WEBSITE
========================= */

showProducts();

updateCart();

/* ===== SAREXBD CUSTOMER REVIEWS ===== */

const reviewForm = document.getElementById("reviewForm");
const reviewsList = document.getElementById("reviewsList");
const reviewMsg = document.getElementById("reviewMsg");

async function loadReviews() {
  if (!reviewsList || !supabaseClient) return;

  const { data, error } = await supabaseClient
    .from("reviews")
    .select("reviewer_name, rating, review_text, created_at")
    .eq("status", "Approved")
    .order("created_at", { ascending: false });

  if (error) {
    reviewsList.textContent = "রিভিউ লোড করা যায়নি।";
    console.error("Review loading error:", error.message);
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
      reviewMsg.textContent = "তথ্যগুলো ঠিকভাবে পূরণ করো।";
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
      reviewMsg.textContent = "রিভিউ জমা হয়নি। আবার চেষ্টা করো।";
      return;
    }

    reviewMsg.textContent =
      "ধন্যবাদ! অনুমোদনের পর তোমার রিভিউ ওয়েবসাইটে দেখা যাবে।";

    reviewForm.reset();
  });
}

loadReviews();
