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

const products = [
  {
    name: "Premium Leather Wallet",
    price: 1200
  },
  {
    name: "Premium Leather Belt",
    price: 1000
  },
  {
    name: "Premium Leather Bag",
    price: 3500
  }
];

let selectedProduct = products[0];
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
