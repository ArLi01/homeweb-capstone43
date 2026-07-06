// HomeWeb – Product Modal + Cart + Checkout + Search + Login //

// PRODUCT DATA //
const products = [
  { id:101, name:'Fresh Kangkong Bundle',         price:25,  oldPrice:null, discount:0,  rating:5, sold:'320',  icon:'fa-carrot',          location:'Sta. Barbara', category:'vegetable' },
  { id:103, name:'Tomato 1kg Pack',               price:80,  oldPrice:100,  discount:20, rating:5, sold:'540',  icon:'fa-carrot',          location:'Sta. Barbara', category:'vegetable' },
  { id:201, name:'Pork Liempo (Belly) 500g',      price:185, oldPrice:220,  discount:16, rating:4, sold:'890',  icon:'fa-drumstick-bite', location:'Sta. Barbara', category:'meat' },
  { id:301, name:'Bangus (Milkfish) 500g',        price:120, oldPrice:150,  discount:20, rating:4, sold:'1.1k', icon:'fa-fish-fins',      location:'Sta. Barbara', category:'seafood' },
  { id:401, name:'Lucky Me Pancit Canton 5-pack', price:55,  oldPrice:null, discount:0,  rating:4, sold:'2.3k', icon:'fa-storefront',     location:'Sta. Barbara', category:'sarisari' },
  { id:404, name:'Milo 300g Pack',                price:120, oldPrice:null, discount:0,  rating:4, sold:'950',  icon:'fa-storefront',          location:'Sta. Barbara', category:'sarisari' },
  { id:501, name:'Wilkins Mineral Water 1L x6',   price:99,  oldPrice:120,  discount:18, rating:4, sold:'1.5k', icon:'fa-bottle-water',   location:'Sta. Barbara', category:'drinks' },
];

// Product image mapping //
const productImages = {
  101: 'images/kangkong2.jpg',
  103: 'images/tomato.jpg',
  201: 'images/pork-liempo.webp',
  301: 'images/bangus.jpg',
  401: 'images/lucky_me1.jpg',
  404: 'images/Milo1.jpg',
  501: 'images/wilkins mineral.jpg',
};

// Helper: get product image or fallback to icon
function getProductImage(id) {
  return productImages[id] || null;
}

//categoryProducts//
document.addEventListener('DOMContentLoaded', function() {
  if (typeof categoryProducts !== 'undefined') {
    categoryProducts.forEach(function(p) {
      if (!products.find(function(x) { return x.id === p.id; })) {
        products.push(p);
      }
    });
  }
});

//  STATE //
let cart = JSON.parse(localStorage.getItem('shopnow_cart') || '[]');
let currentProduct = null;    
let checkoutStep = 1;         
let currentUser = null;      
let currentTrackingOrder = null; 
let shippingInfo = {
  firstName: '', lastName: '', phone: '',
  street: '', city: 'Sta. Barbara', zip: '5002',
  delivery: 'standard'
};

//  ORDERS (TRACKING) — now fetched from Supabase, this is just an in-memory cache //
let orders = [];

//  HELPERS //
const fmt = n => '\u20B1' + Number(n).toLocaleString();

// Star rating icons //
function stars(n) {
  let s = '';
  for (let i = 1; i <= 5; i++)
    s += '<i class="' + (i <= n ? 'fas' : 'far') + ' fa-star"></i>';
  return s;
}

// Save cart localStorage //
function saveCart() {
  localStorage.setItem('shopnow_cart', JSON.stringify(cart));
}

function updateCartBadge() {
  const total = cart.reduce((a, b) => a + b.qty, 0);
  document.querySelectorAll('.cart-badge').forEach(el => {
    el.textContent = total;
    el.style.display = total ? 'inline' : 'none';
  });
}

// Toast notifications //
function showToast(msg, type) {
  type = type || 'success';
  const t = document.getElementById('sn-toast');
  t.textContent = msg;
  t.className = 'sn-toast sn-toast--' + type + ' sn-toast--show';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('sn-toast--show'), 2800);
}

// SEARCH // 

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightText(text, query) {
  if (!query) return text;
  return text.replace(
    new RegExp('(' + escapeRegex(query) + ')', 'gi'),
    '<mark style="background:#ffe680;color:#5a4000;border-radius:2px;padding:0 1px">$1</mark>'
  );
}

// Main search filter function //
function filterProducts(query) {
  const q = query.trim().toLowerCase();
  let shown = 0;

  // Check each product card //
  document.querySelectorAll('.product-card').forEach(function(card) {
    const id = Number(card.dataset.productId);
    const product = products.find(function(p) { return p.id === id; });
    if (!product) return;

    const matches = !q || product.name.toLowerCase().includes(q);
    card.style.display = matches ? '' : 'none';
    if (matches) shown++;

    const nameEl = card.querySelector('.product-name, .product-title, h3, h4, p.name, [class*="name"]');
    if (nameEl) {
      if (nameEl.dataset.originalText === undefined) {
        nameEl.dataset.originalText = nameEl.textContent;
      }
      nameEl.innerHTML = (matches && q)
        ? highlightText(nameEl.dataset.originalText, query.trim())
        : nameEl.dataset.originalText;
    }
  });

  // Hide section headings //
  ['flash-sale', 'recommended'].forEach(function(sectionClass) {
    const section = document.querySelector('.' + sectionClass);
    if (!section) return;
    const visibleCards = section.querySelectorAll('.product-card:not([style*="display: none"])');
    const heading = section.querySelector('h2, h3, .section-title');
    if (heading) heading.style.display = visibleCards.length === 0 ? 'none' : '';
  });

  // Empty state message //
  var emptyMsg = document.getElementById('sn-search-empty');
  if (!emptyMsg) {
    emptyMsg = document.createElement('div');
    emptyMsg.id = 'sn-search-empty';
    emptyMsg.style.cssText = [
      'text-align:center',
      'padding:3rem 1rem',
      'color:#999',
      'font-size:15px',
      'display:none'
    ].join(';');
    emptyMsg.innerHTML =
      '<i class="fas fa-search" style="font-size:32px;display:block;margin-bottom:12px;opacity:0.4"></i>' +
      'No products found for "<span id="sn-search-term"></span>"';
    var lastSection = document.querySelector('.recommended') || document.querySelector('.flash-sale');
    if (lastSection) lastSection.after(emptyMsg);
    else document.body.appendChild(emptyMsg);
  }

  if (shown === 0 && q) {
    emptyMsg.style.display = 'block';
    var termEl = document.getElementById('sn-search-term');
    if (termEl) termEl.textContent = query.trim();
  } else {
    emptyMsg.style.display = 'none';
  }

  // Result count //
  var hint = document.getElementById('sn-search-count');
  if (hint) {
    hint.textContent = q
      ? (shown + ' result' + (shown !== 1 ? 's' : '') + ' found')
      : '';
  }
}

function initSearch() {
  var input = document.querySelector(
    'input[type="search"], ' +
    '.search-bar input, ' +
    '.search-input, ' +
    'input[placeholder*="earch"]'
  );

  if (!input) {
    console.warn('HomeWeb search: walang search input na nahanap. Check mo yung selector.');
    return;
  }

  // Live filter //
  input.addEventListener('input', function() {
    filterProducts(this.value);
  });

  // Escape key to clear search //
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      this.value = '';
      filterProducts('');
    }
  });

  // Clear search //
  input.addEventListener('search', function() {
    filterProducts(this.value);
  });
}

// INJECT DATA-IDS onto existing cards //
function injectProductIds() {
  document.querySelectorAll('.flash-sale .product-card').forEach(function(card, i) {
    if (!card.dataset.productId) card.dataset.productId = i + 1;
  });
  document.querySelectorAll('.recommended .product-card').forEach(function(card, i) {
    if (!card.dataset.productId) card.dataset.productId = i + 6;
  });
}

//  ATTACH CLICK TO ALL PRODUCT CARDS  //
function attachCardClicks() {
  document.querySelectorAll('.product-card').forEach(function(card) {
    card.style.cursor = 'pointer';
    card.addEventListener('click', function(e) {
      if (e.target.closest('.wishlist-btn')) return;
      const idx = this.dataset.productId;
      if (idx) openProductModal(Number(idx));
    });
  });

  // Wishlist toggle //
  document.querySelectorAll('.wishlist-btn').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      const icon = this.querySelector('i');
      if (icon.classList.contains('far')) {
        icon.classList.replace('far', 'fas');
        icon.style.color = '#EE4D2D';
        showToast('Added to wishlist \u2665');
      } else {
        icon.classList.replace('fas', 'far');
        icon.style.color = '';
        showToast('Removed from wishlist', 'info');
      }
    });
  });
}

// PRODUCT MODAL //
function openProductModal(id) {
  const p = products.find(function(x) { return x.id === id; });
  if (!p) return;
  currentProduct = Object.assign({}, p, { qty: 1 });

  const m = document.getElementById('sn-productModal');
  var imgSrc = getProductImage(p.id);
  if (imgSrc) {
    m.querySelector('.pm-icon').innerHTML = '<img src="' + imgSrc + '" alt="' + p.name + '" />';
  } else {
    m.querySelector('.pm-icon').innerHTML = '<i class="fas ' + p.icon + '"></i>';
  }
  m.querySelector('.pm-name').textContent = p.name;
  m.querySelector('.pm-stars').innerHTML = stars(p.rating) + '<span>' + p.sold + ' sold</span>';
  m.querySelector('.pm-price-now').textContent = fmt(p.price);
  m.querySelector('.pm-price-old').textContent = p.oldPrice ? fmt(p.oldPrice) : '';
  const disc = m.querySelector('.pm-discount');
  disc.textContent = p.discount ? '-' + p.discount + '%' : '';
  disc.style.display = p.discount ? 'inline' : 'none';
  m.querySelector('.pm-location').innerHTML = '<i class="fas fa-map-marker-alt"></i> Ships from ' + p.location;
  m.querySelector('.pm-qty-val').textContent = 1;

  document.getElementById('sn-overlay').classList.add('active');
  m.classList.add('active');
  document.body.style.overflow = 'hidden'; 
}

function closeProductModal() {
  document.getElementById('sn-overlay').classList.remove('active');
  document.getElementById('sn-productModal').classList.remove('active');
  document.body.style.overflow = '';
}

// buttons sa product modal //
function changeQty(delta) {
  currentProduct.qty = Math.max(1, Math.min(99, currentProduct.qty + delta));
  document.querySelector('.pm-qty-val').textContent = currentProduct.qty;
}

// Add to cart //
function addToCart(andCheckout) {
  const p = currentProduct;
  const existing = cart.find(function(x) { return x.id === p.id; });
  if (existing) existing.qty += p.qty;
  else cart.push({ id: p.id, name: p.name, price: p.price, icon: p.icon, qty: p.qty });
  saveCart();
  updateCartBadge();

  if (andCheckout) {
    closeProductModal();
    openCheckout();
  } else {
    closeProductModal();
    showToast(p.name + ' added to cart \uD83D\uDED2');
  }
}

// CHECKOUT FLOW //

function openCheckout() {
  if (!cart.length) { showToast('Your cart is empty', 'info'); return; }
  checkoutStep = 1;
  renderCheckout();
  document.getElementById('sn-coOverlay').classList.add('active');
  document.getElementById('sn-checkoutModal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeCheckout() {
  document.getElementById('sn-coOverlay').classList.remove('active');
  document.getElementById('sn-checkoutModal').classList.remove('active');
  document.body.style.overflow = '';
}

// Render the entire checkout //
function renderCheckout() {
  const modal = document.getElementById('sn-checkoutModal');

  // Step indicator bar — Cart > Shipping > Payment > Confirm //
  const stepNames = ['Cart', 'Shipping', 'Payment', 'Confirm'];
  const stepBar = stepNames.map(function(s, i) {
    return '<div class="co-step ' + (i + 1 === checkoutStep ? 'active' : '') + ' ' + (i + 1 < checkoutStep ? 'done' : '') + '">' +
      '<div class="co-step-num">' + (i + 1 < checkoutStep ? '<i class="fas fa-check"></i>' : (i + 1)) + '</div>' +
      '<span>' + s + '</span></div>' +
      (i < stepNames.length - 1 ? '<div class="co-step-line"></div>' : '');
  }).join('');

  let body = '';

  // STEP 1: CART //
  if (checkoutStep === 1) {
    const rows = cart.map(function(item) {
      var cartImgSrc = getProductImage(item.id);
      var cartIconHtml = cartImgSrc
        ? '<img src="' + cartImgSrc + '" alt="' + item.name + '" />'
        : '<i class="fas ' + item.icon + '"></i>';
      return '<div class="co-cart-row" data-id="' + item.id + '">' +
        '<div class="co-cart-icon">' + cartIconHtml + '</div>' +
        '<div class="co-cart-info"><p class="co-cart-name">' + item.name + '</p>' +
        '<div class="co-cart-controls">' +
        '<button onclick="changeCartQty(' + item.id + ',-1)">&#8722;</button>' +
        '<span>' + item.qty + '</span>' +
        '<button onclick="changeCartQty(' + item.id + ',1)">+</button>' +
        '<button class="co-remove" onclick="removeCartItem(' + item.id + ')"><i class="fas fa-trash"></i></button>' +
        '</div></div>' +
        '<div class="co-cart-price">' + fmt(item.price * item.qty) + '</div></div>';
    }).join('');

    const sub = cart.reduce(function(a, b) { return a + b.price * b.qty; }, 0);
    // Free shipping //
    const ship = sub >= 500 ? 0 : 79;

    body = '<div class="co-cart-list">' + rows + '</div>' +
      '<div class="co-summary">' +
      '<div class="co-summary-row"><span>Subtotal</span><span>' + fmt(sub) + '</span></div>' +
      '<div class="co-summary-row"><span>Shipping</span><span>' + (ship === 0 ? '<span class="free-tag">FREE</span>' : fmt(ship)) + '</span></div>' +
      '<div class="co-summary-row total"><span>Total</span><span>' + fmt(sub + ship) + '</span></div>' +
      '</div>';

  // STEP 2: SHIPPING //
  } else if (checkoutStep === 2) {
    body = '<div class="co-form">' +
      '<h3>Delivery Address</h3>' +
      '<div class="co-form-row">' +
      '<div class="co-field"><label>First Name <span class="co-required">*</span></label><input type="text" id="co-firstName" placeholder="First Name" value="' + shippingInfo.firstName + '"/><span class="co-field-error">First name is required</span></div>' +
      '<div class="co-field"><label>Last Name <span class="co-required">*</span></label><input type="text" id="co-lastName" placeholder="Last Name" value="' + shippingInfo.lastName + '"/><span class="co-field-error">Last name is required</span></div>' +
      '</div>' +
      '<div class="co-field"><label>Phone Number <span class="co-required">*</span></label><input type="tel" id="co-phone" placeholder="+63 9XX XXX XXXX" value="' + shippingInfo.phone + '"/><span class="co-field-error">Phone number is required</span></div>' +
      '<div class="co-field"><label>Street Address <span class="co-required">*</span></label><input type="text" id="co-street" placeholder="House No., Street, Barangay" value="' + shippingInfo.street + '"/><span class="co-field-error">Street address is required</span></div>' +
      '<div class="co-form-row">' +
      '<div class="co-field"><label>City / Municipality <span class="co-required">*</span></label><input type="text" id="co-city" placeholder="Sta. Barbara" value="' + shippingInfo.city + '"/><span class="co-field-error">City is required</span></div>' +
      '<div class="co-field"><label>ZIP Code <span class="co-required">*</span></label><input type="text" id="co-zip" placeholder="5002" value="' + shippingInfo.zip + '"/><span class="co-field-error">ZIP code is required</span></div>' +
      '</div>' +
      '<div class="co-field"><label>Delivery Option</label>' +
      '<div class="co-delivery-opts">' +
      '<label class="co-radio"><input type="radio" name="delivery" value="standard" ' + (shippingInfo.delivery === 'standard' ? 'checked' : '') + '/>' +
      '<span><strong>Standard Delivery</strong><em>3\u201320 minutes &nbsp;&bull;&nbsp; FREE on \u20B1200+</em></span></label>' +
      '<label class="co-radio"><input type="radio" name="delivery" value="Saver" ' + (shippingInfo.delivery === 'Saver' ? 'checked' : '') + '/>' +
      '<span><strong>Saver Delivery</strong><em>1\u201330 minutes &nbsp;&bull;&nbsp; \u20B1149</em></span></label>' +
      '</div></div></div>';

  // STEP 3: PAYMENT //
  } else if (checkoutStep === 3) {
    body = '<div class="co-form">' +
      '<h3>Payment Method</h3>' +
      '<div class="co-pay-opts">' +
      '<label class="co-radio co-pay-radio"><input type="radio" name="payment" value="cod" checked/>' +
      '<span><i class="fas fa-money-bill-wave"></i><strong>Cash on Delivery</strong></span></label>' +
      '<label class="co-radio co-pay-radio"><input type="radio" name="payment" value="gcash"/>' +
      '<span><i class="fas fa-mobile-alt"></i><strong>GCash</strong></span></label>' +
      '</div>' +
      '<div id="sn-cardFields" style="display:none" class="co-card-fields">' +
      '<div class="co-field"><label>Card Number</label><input type="text" placeholder="1234 5678 9012 3456" maxlength="19"/></div>' +
      '<div class="co-form-row">' +
      '<div class="co-field"><label>Expiry</label><input type="text" placeholder="MM/YY" maxlength="5"/></div>' +
      '<div class="co-field"><label>CVV</label><input type="text" placeholder="123" maxlength="3"/></div>' +
      '</div>' +
      '<div class="co-field"><label>Name on Card</label><input type="text" placeholder="JUAN DELA CRUZ"/></div>' +
      '</div></div>';

  // STEP 4: CONFIRM ORDER //
  } else if (checkoutStep === 4) {
    const sub = cart.reduce(function(a, b) { return a + b.price * b.qty; }, 0);
    const ship = sub >= 500 ? 0 : 79;
    const itemList = cart.map(function(i) {
      return '<li><span>' + i.name + ' \u00D7 ' + i.qty + '</span><span>' + fmt(i.price * i.qty) + '</span></li>';
    }).join('');

    body = '<div class="co-confirm">' +
      '<div class="co-confirm-icon"><i class="fas fa-clipboard-check"></i></div>' +
      '<h3>Review Your Order</h3>' +
      '<ul class="co-confirm-items">' + itemList + '</ul>' +
      '<div class="co-summary">' +
      '<div class="co-summary-row"><span>Subtotal</span><span>' + fmt(sub) + '</span></div>' +
      '<div class="co-summary-row"><span>Shipping</span><span>' + (ship === 0 ? '<span class="free-tag">FREE</span>' : fmt(ship)) + '</span></div>' +
      '<div class="co-summary-row total"><span>Total</span><span>' + fmt(sub + ship) + '</span></div>' +
      '</div>' +
      '<p class="co-note"><i class="fas fa-shield-alt"></i> Your payment is protected by HomeWeb Guarantee.</p>' +
      '</div>';
  }

  // Footer buttons //
  const nextLabel = checkoutStep === 4 ? 'Place Order' : 'Continue';
  const nextIcon  = checkoutStep === 4 ? 'fa-check-circle' : 'fa-arrow-right';
  const backBtn   = checkoutStep > 1
    ? '<button class="co-btn co-btn--back" onclick="goStep(-1)"><i class="fas fa-arrow-left"></i> Back</button>'
    : '<button class="co-btn co-btn--back" onclick="closeCheckout()">Cancel</button>';

  modal.innerHTML =
    '<div class="co-header">' +
    '<h2><i class="fas fa-shopping-bag"></i> Checkout</h2>' +
    '<button class="co-close" onclick="closeCheckout()"><i class="fas fa-times"></i></button>' +
    '</div>' +
    '<div class="co-steps">' + stepBar + '</div>' +
    '<div class="co-body">' + body + '</div>' +
    '<div class="co-footer">' + backBtn +
    '<button class="co-btn co-btn--next" onclick="goStep(1)">' + nextLabel + ' <i class="fas ' + nextIcon + '"></i></button>' +
    '</div>';

  // shipping step //
  if (checkoutStep === 2) {
    modal.querySelectorAll('.co-field input').forEach(function(input) {
      input.addEventListener('input', function() {
        this.closest('.co-field').classList.remove('co-field--error');
      });
    });
  }

  // Payment step //
  if (checkoutStep === 3) {
    modal.querySelectorAll('input[name="payment"]').forEach(function(r) {
      r.addEventListener('change', function() {
        var cf = document.getElementById('sn-cardFields');
        if (cf) cf.style.display = this.value === 'card' ? 'block' : 'none';
      });
    });
  }
}

// Validate shipping form //
function validateShippingForm() {
  const requiredIds = ['co-firstName', 'co-lastName', 'co-phone', 'co-street', 'co-city', 'co-zip'];
  let isValid = true;
  let firstInvalidEl = null;

  requiredIds.forEach(function(id) {
    const input = document.getElementById(id);
    if (!input) return;
    const field = input.closest('.co-field');
    if (!input.value.trim()) {
      isValid = false;
      if (field) field.classList.add('co-field--error');
      if (!firstInvalidEl) firstInvalidEl = input;
    } else if (field) {
      field.classList.remove('co-field--error');
    }
  });

  if (firstInvalidEl) firstInvalidEl.focus();
  return isValid;
}

function saveShippingForm() {
  const get = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
  shippingInfo.firstName = get('co-firstName');
  shippingInfo.lastName  = get('co-lastName');
  shippingInfo.phone     = get('co-phone');
  shippingInfo.street    = get('co-street');
  shippingInfo.city      = get('co-city');
  shippingInfo.zip       = get('co-zip');
  const deliveryEl = document.querySelector('input[name="delivery"]:checked');
  if (deliveryEl) shippingInfo.delivery = deliveryEl.value;
}

// Navigate between checkout steps //
function goStep(delta) {
  if (delta === 1 && checkoutStep === 4) { placeOrder(); return; }

  if (delta === 1 && checkoutStep === 2) {
    saveShippingForm();
    if (!validateShippingForm()) {
      showToast('Please fill in all required shipping fields', 'info');
      return;
    }
  }

  checkoutStep = Math.max(1, Math.min(4, checkoutStep + delta));
  renderCheckout();
}

// Change quantity inside checkout cart //
function changeCartQty(id, delta) {
  var item = cart.find(function(x) { return x.id === id; });
  if (!item) return;
  item.qty = Math.max(1, item.qty + delta);
  saveCart();
  updateCartBadge();
  renderCheckout();
}

// Remove item from cart
function removeCartItem(id) {
  cart = cart.filter(function(x) { return x.id !== id; });
  saveCart();
  updateCartBadge();
  if (!cart.length) { closeCheckout(); showToast('Cart is empty', 'info'); return; }
  renderCheckout();
}

var ORDER_STATUS_MAP = {
  'placed':           { label: 'Order Placed',          desc: 'Your order has been received and is being reviewed.' },
  'preparing':        { label: 'Preparing Your Order',  desc: 'The seller is packing your items with care.' },
  'out_for_delivery': { label: 'Out for Delivery',      desc: 'Your rider is on the way to deliver your order!' },
  'delivered':        { label: 'Delivered',             desc: 'Your order has been delivered. Enjoy!' }
};

// Place order — writes to Supabase (orders, order_items, order_status_history) //
async function placeOrder() {
  if (!currentUser) {
    showToast('Please log in to place an order', 'info');
    closeCheckout();
    openLoginModal();
    return;
  }

  const sub = cart.reduce(function(a, b) { return a + b.price * b.qty; }, 0);
  const shipFee = sub >= 500 ? 0 : 79;

  var payEl = document.querySelector('input[name="payment"]:checked');
  var paymentMethod = payEl ? payEl.value : 'cod';
  var orderCode = 'HW' + String(Date.now()).slice(-8).toUpperCase();

  const nextBtn = document.querySelector('#sn-checkoutModal .co-btn--next');
  if (nextBtn) { nextBtn.disabled = true; nextBtn.textContent = 'Placing order...'; }

  // 1. Insert the order
  const { data: orderRow, error: orderErr } = await supabase.from('orders').insert({
    order_code: orderCode,
    user_id: currentUser.id,
    status: 'placed',
    subtotal: sub,
    shipping_fee: shipFee,
    total: sub + shipFee,
    payment_method: paymentMethod,
    shipping_first_name: shippingInfo.firstName,
    shipping_last_name: shippingInfo.lastName,
    shipping_phone: shippingInfo.phone,
    shipping_street: shippingInfo.street,
    shipping_city: shippingInfo.city,
    shipping_zip: shippingInfo.zip,
    delivery_option: shippingInfo.delivery
  }).select().single();

  if (orderErr) {
    if (nextBtn) { nextBtn.disabled = false; nextBtn.innerHTML = 'Place Order <i class="fas fa-check-circle"></i>'; }
    showToast('Could not place order: ' + orderErr.message, 'error');
    return;
  }

  // 2. Insert order items
  const itemRows = cart.map(function(item) {
    return { order_id: orderRow.id, product_id: item.id, product_name: item.name, price: item.price, qty: item.qty };
  });
  await supabase.from('order_items').insert(itemRows);

  // 3. Insert the first status history entry
  await supabase.from('order_status_history').insert({
    order_id: orderRow.id,
    status: 'placed',
    label: ORDER_STATUS_MAP.placed.label,
    description: ORDER_STATUS_MAP.placed.desc
  });

  // Simulate the seller progressing the order (writes real rows to the DB) //
  setTimeout(function() { advanceOrderStatus(orderRow.id, 'preparing'); }, 8000);
  setTimeout(function() { advanceOrderStatus(orderRow.id, 'out_for_delivery'); }, 20000);

  // Clear cart
  closeCheckout();
  cart = [];
  saveCart();
  updateCartBadge();
  showOrderSuccess(orderCode);
}

// Advance an order's status in Supabase + log it to the timeline //
async function advanceOrderStatus(orderDbId, newStatus) {
  const info = ORDER_STATUS_MAP[newStatus];
  if (!info) return;

  const { data: existing } = await supabase.from('orders').select('status').eq('id', orderDbId).single();
  if (!existing || existing.status === 'delivered') return;

  await supabase.from('orders').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', orderDbId);
  await supabase.from('order_status_history').insert({
    order_id: orderDbId,
    status: newStatus,
    label: info.label,
    description: info.desc
  });

  if (currentTrackingOrder && currentTrackingOrder.id === orderDbId) {
    openTrackingDetail(orderDbId);
  }
  var listEl = document.getElementById('sn-tracking-list');
  if (listEl && listEl.style.display !== 'none') renderOrderList();
}

// Mark order as delivered (manual override, e.g. for demo purposes) //
async function markDelivered(orderDbId) {
  await advanceOrderStatus(orderDbId, 'delivered');
  showToast('Order marked as delivered \u2705');
}

// Show order success modal with generated order code //
function showOrderSuccess(orderCode) {
  document.getElementById('sn-orderId').textContent = orderCode;
  document.getElementById('sn-successOverlay').classList.add('active');
  document.getElementById('sn-successModal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeSuccess() {
  document.getElementById('sn-successOverlay').classList.remove('active');
  document.getElementById('sn-successModal').classList.remove('active');
  document.body.style.overflow = '';
}

// ORDER TRACKING //
async function openOrderTracking(e) {
  if (e) e.preventDefault();

  if (!currentUser) {
    showToast('Please log in to view your orders', 'info');
    openLoginModal();
    return;
  }

  document.getElementById('sn-trackingOverlay').classList.add('active');
  document.getElementById('sn-trackingModal').classList.add('active');
  document.body.style.overflow = 'hidden';

  var listEl = document.getElementById('sn-tracking-list');
  if (listEl) listEl.innerHTML = '<div class="track-empty"><p>Loading your orders...</p></div>';

  await fetchOrders();
  renderOrderList();
}

// Fetch this user's orders (with their items) from Supabase //
async function fetchOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false });

  if (error) {
    showToast('Could not load orders: ' + error.message, 'error');
    orders = [];
    return;
  }
  orders = data || [];
}

function closeOrderTracking() {
  document.getElementById('sn-trackingOverlay').classList.remove('active');
  document.getElementById('sn-trackingModal').classList.remove('active');
  document.getElementById('sn-tracking-list').style.display = '';
  document.getElementById('sn-tracking-detail').style.display = 'none';
  currentTrackingOrder = null;
  document.body.style.overflow = '';
}

function renderOrderList() {
  var container = document.getElementById('sn-tracking-list');
  if (!container) return;

  if (!orders.length) {
    container.innerHTML =
      '<div class="track-empty">' +
      '<h3>No orders yet</h3>' +
      '<p>When you place an order, it will appear here.</p>' +
      '<button class="co-btn co-btn--next" onclick="closeOrderTracking()">Start Shopping</button>' +
      '</div>';
    return;
  }

  var html = '<div class="track-order-list">';
  orders.forEach(function(order) {
    var statusInfo = getOrderStatusInfo(order.status);
    var dateStr = formatDate(order.created_at);

    var itemNames = (order.order_items || []).map(function(item) {
      return item.product_name + (item.qty > 1 ? ' x' + item.qty : '');
    }).join(', ');

    html += '<div class="track-order-card" onclick="openTrackingDetail(\'' + order.id + '\')">' +
      '<div class="track-card-top">' +
      '<div class="track-card-id">' + order.order_code + '</div>' +
      '<span class="track-status-text"> - ' + statusInfo.label + '</span>' +
      '</div>' +
      '<div class="track-card-items-text">' + itemNames + '</div>' +
      '<div class="track-card-bottom">' +
      '<span class="track-card-date">' + dateStr + '</span>' +
      '<span class="track-card-total">' + fmt(order.total) + '</span>' +
      '</div>' +
      '</div>';
  });
  html += '</div>';

  container.innerHTML = html;
}

async function openTrackingDetail(orderId) {
  const { data: order, error } = await supabase
    .from('orders')
    .select('*, order_items(*), order_status_history(*)')
    .eq('id', orderId)
    .single();

  if (error || !order) {
    showToast('Could not load order details', 'error');
    return;
  }

  currentTrackingOrder = order;
  renderTrackingDetail(order);
  document.getElementById('sn-tracking-list').style.display = 'none';
  document.getElementById('sn-tracking-detail').style.display = '';
}

function renderTrackingDetail(order) {
  var container = document.getElementById('sn-tracking-detail');
  if (!container) return;

  var statusInfo = getOrderStatusInfo(order.status);
  var dateStr = formatDate(order.created_at);

  // Build simple text timeline (most recent first)
  var timelineHtml = '<div class="track-timeline">';
  var sortedHistory = (order.order_status_history || []).slice().sort(function(a, b) {
    return new Date(b.created_at) - new Date(a.created_at);
  });
  sortedHistory.forEach(function(entry) {
    timelineHtml += '<div class="track-tl-row">' +
      '<span class="track-tl-label">' + entry.label + '</span>' +
      '<span class="track-tl-time">' + formatTime(entry.created_at) + '</span>' +
      '</div>' +
      '<div class="track-tl-desc">' + entry.description + '</div>';
  });
  timelineHtml += '</div>';

  // Items list
  var itemsHtml = (order.order_items || []).map(function(item) {
    return '<div class="track-detail-item">' +
      '<span class="track-detail-item-name">' + item.product_name + '</span>' +
      '<span class="track-detail-item-qty">' + item.qty + ' x ' + fmt(item.price) + '</span>' +
      '<span class="track-detail-item-sub">' + fmt(item.price * item.qty) + '</span>' +
      '</div>';
  }).join('');

  // Delivery address
  var addressStr = (order.shipping_street || '') + ', ' + (order.shipping_city || '') + ' ' + (order.shipping_zip || '');

  var html =
    '<div class="track-detail-back" onclick="openOrderTracking()">Back to orders</div>' +

    '<h3>' + statusInfo.label + ' — Order #' + order.order_code + '</h3>' +

    // Timeline
    '<div class="track-detail-section">' +
    '<h4>Tracking Timeline</h4>' +
    timelineHtml +
    '</div>' +

    // Items
    '<div class="track-detail-section">' +
    '<h4>Order Items</h4>' +
    '<div class="track-detail-items">' + itemsHtml + '</div>' +
    '</div>' +

    // Summary + Address
    '<div class="track-detail-section">' +
    '<h4>Delivery Address</h4>' +
    '<p>' + (order.shipping_first_name || '') + ' ' + (order.shipping_last_name || '') + '</p>' +
    '<p>' + addressStr + '</p>' +
    '<p>' + (order.shipping_phone || '') + '</p>' +
    '</div>' +

    '<div class="track-detail-section">' +
    '<h4>Order Summary</h4>' +
    '<div class="track-summary-rows">' +
    '<div class="track-summary-row"><span>Subtotal</span><span>' + fmt(order.subtotal) + '</span></div>' +
    '<div class="track-summary-row"><span>Shipping</span><span>' + (Number(order.shipping_fee) === 0 ? 'FREE' : fmt(order.shipping_fee)) + '</span></div>' +
    '<div class="track-summary-row total"><span>Total</span><span>' + fmt(order.total) + '</span></div>' +
    '<div class="track-summary-row"><span>Payment</span><span>' + (order.payment_method === 'cod' ? 'Cash on Delivery' : order.payment_method === 'gcash' ? 'GCash' : order.payment_method) + '</span></div>' +
    '<div class="track-summary-row"><span>Placed on</span><span>' + dateStr + '</span></div>' +
    '</div>' +
    '</div>';

  // Mark as delivered button (only if not yet delivered)
  if (order.status !== 'delivered') {
    html += '<button class="co-btn co-btn--next track-mark-delivered" onclick="markDelivered(\'' + order.id + '\')">' +
      'Mark as Delivered</button>';
  }

  container.innerHTML = html;
}

// Helpers for order tracking
function getOrderStatusInfo(status) {
  var map = {
    'placed':            { label: 'Order Placed',       icon: '' },
    'preparing':         { label: 'Preparing',          icon: '' },
    'out_for_delivery':  { label: 'Out for Delivery',   icon: '' },
    'delivered':         { label: 'Delivered',          icon: '' }
  };
  return map[status] || map['placed'];
}

function formatDate(isoStr) {
  var d = new Date(isoStr);
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
}

function formatTime(isoStr) {
  var d = new Date(isoStr);
  var h = d.getHours();
  var m = String(d.getMinutes()).padStart(2, '0');
  var ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return h + ':' + m + ' ' + ampm;
}

// LOGIN MODAL //

// Open login modal //
function openLoginModal(e) {
  if (e) e.preventDefault();
  if (currentUser) return; 

  // Clear form fields
  ['login-email', 'login-password'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) { el.value = ''; el.closest('.co-field').classList.remove('co-field--error'); }
  });
  var remember = document.getElementById('login-remember');
  if (remember) remember.checked = false;

  document.getElementById('sn-loginOverlay').classList.add('active');
  document.getElementById('sn-loginModal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeLoginModal() {
  document.getElementById('sn-loginOverlay').classList.remove('active');
  document.getElementById('sn-loginModal').classList.remove('active');
  document.body.style.overflow = '';
}

// Validate login form //
function validateLoginForm() {
  const emailEl = document.getElementById('login-email');
  const passEl = document.getElementById('login-password');
  let isValid = true;
  let firstInvalidEl = null;

  const emailField = emailEl.closest('.co-field');
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailEl.value.trim());
  if (!emailOk) {
    isValid = false;
    emailField.classList.add('co-field--error');
    firstInvalidEl = firstInvalidEl || emailEl;
  } else {
    emailField.classList.remove('co-field--error');
  }

  const passField = passEl.closest('.co-field');
  if (!passEl.value) {
    isValid = false;
    passField.classList.add('co-field--error');
    firstInvalidEl = firstInvalidEl || passEl;
  } else {
    passField.classList.remove('co-field--error');
  }

  if (firstInvalidEl) firstInvalidEl.focus();
  return isValid;
}

// Submit login //
async function submitLogin() {
  if (!validateLoginForm()) {
    showToast('Please fix the errors below', 'info');
    return;
  }
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  const btn = document.querySelector('#sn-loginModal .login-submit');
  if (btn) { btn.disabled = true; btn.textContent = 'Logging in...'; }

  const { data, error } = await supabase.auth.signInWithPassword({ email: email, password: password });

  if (btn) { btn.disabled = false; btn.innerHTML = 'Log In <i class="fas fa-arrow-right"></i>'; }

  if (error) {
    showToast(error.message, 'error');
    return;
  }

  currentUser = data.user;
  closeLoginModal();
  updateAuthUI();
  showToast('Welcome back, ' + (currentUser.email || '').split('@')[0] + '!');
}

// Logout //
async function logout() {
  await supabase.auth.signOut();
  currentUser = null;
  updateAuthUI();
  showToast('Logged out', 'info');
}

// ============================================================
// SIGNUP MODAL
// ============================================================

function openSignupModal(e) {
  if (e) e.preventDefault();
  if (currentUser) return;

  ['signup-name', 'signup-email', 'signup-password', 'signup-password2'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) { el.value = ''; el.closest('.co-field').classList.remove('co-field--error'); }
  });

  document.getElementById('sn-signupOverlay').classList.add('active');
  document.getElementById('sn-signupModal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeSignupModal() {
  document.getElementById('sn-signupOverlay').classList.remove('active');
  document.getElementById('sn-signupModal').classList.remove('active');
  document.body.style.overflow = '';
}

function validateSignupForm() {
  const nameEl = document.getElementById('signup-name');
  const emailEl = document.getElementById('signup-email');
  const passEl = document.getElementById('signup-password');
  const pass2El = document.getElementById('signup-password2');
  let isValid = true;
  let firstInvalidEl = null;

  function markError(el, ok) {
    const field = el.closest('.co-field');
    if (!ok) {
      isValid = false;
      field.classList.add('co-field--error');
      firstInvalidEl = firstInvalidEl || el;
    } else {
      field.classList.remove('co-field--error');
    }
  }

  markError(nameEl, nameEl.value.trim().length > 0);
  markError(emailEl, /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailEl.value.trim()));
  markError(passEl, passEl.value.length >= 6);
  markError(pass2El, pass2El.value === passEl.value && pass2El.value.length >= 6);

  if (firstInvalidEl) firstInvalidEl.focus();
  return isValid;
}

async function submitSignup() {
  if (!validateSignupForm()) {
    showToast('Please fix the errors below', 'info');
    return;
  }

  const name = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;

  const btn = document.getElementById('signup-submit-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Creating account...'; }

  const { data, error } = await supabase.auth.signUp({
    email: email,
    password: password,
    options: { data: { full_name: name } }
  });

  if (btn) { btn.disabled = false; btn.innerHTML = 'Sign Up <i class="fas fa-arrow-right"></i>'; }

  if (error) {
    showToast(error.message, 'error');
    return;
  }

  // If "Confirm email" is turned off in Supabase settings, data.session
  // will already be set and the user is logged in immediately.
  if (data.session) {
    currentUser = data.user;
    closeSignupModal();
    updateAuthUI();
    showToast('Account created! Welcome, ' + name.split(' ')[0] + '!');
  } else {
    closeSignupModal();
    showToast('Account created! Please check your email to confirm.', 'info');
  }
}

// Restore session on page load (so refreshing doesn't log the user out) //
async function restoreSession() {
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    currentUser = data.session.user;
    updateAuthUI();
  }

  supabase.auth.onAuthStateChange(function(event, session) {
    currentUser = session ? session.user : null;
    updateAuthUI();
  });
}

// Update topbar login link //
function updateAuthUI() {
  document.querySelectorAll('.sn-login-link').forEach(function(link) {
    if (currentUser) {
      link.innerHTML = '<i class="fas fa-user-check"></i> ' + currentUser.email.split('@')[0];
      link.onclick = function(e) { e.preventDefault(); logout(); };
    } else {
      link.innerHTML = '<i class="fas fa-sign-in-alt"></i> Log In';
      link.onclick = function(e) { e.preventDefault(); openLoginModal(e); };
    }
  });
}

function initLoginModal() {
  updateAuthUI();

  ['login-email', 'login-password'].forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', function() {
      this.closest('.co-field').classList.remove('co-field--error');
    });
    el.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') submitLogin();
    });
  });

  ['signup-name', 'signup-email', 'signup-password', 'signup-password2'].forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', function() {
      this.closest('.co-field').classList.remove('co-field--error');
    });
    el.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') submitSignup();
    });
  });
}

// INJECT MODAL HTML //
function injectModals() {
  var html =
    // Toast notification
    '<div id="sn-toast" class="sn-toast"></div>' +

    // Overlay pra sa product modal
    '<div id="sn-overlay" class="sn-overlay" onclick="closeProductModal()"></div>' +

    // Product modal
    '<div id="sn-productModal" class="sn-product-modal">' +
    '<button class="pm-close" onclick="closeProductModal()"><i class="fas fa-times"></i></button>' +
    '<div class="pm-body">' +
    '<div class="pm-icon"><i class="fas fa-box"></i></div>' +
    '<div class="pm-details">' +
    '<p class="pm-name"></p>' +
    '<div class="pm-stars"></div>' +
    '<div class="pm-prices">' +
    '<span class="pm-price-now"></span>' +
    '<span class="pm-price-old"></span>' +
    '<span class="pm-discount"></span>' +
    '</div>' +
    '<p class="pm-location"></p>' +
    '<div class="pm-qty">' +
    '<span>Quantity:</span>' +
    '<button onclick="changeQty(-1)">&#8722;</button>' +
    '<span class="pm-qty-val">1</span>' +
    '<button onclick="changeQty(1)">+</button>' +
    '</div>' +
    '<div class="pm-actions">' +
    '<button class="pm-btn pm-btn--cart" onclick="addToCart(false)"><i class="fas fa-cart-plus"></i> Add to Cart</button>' +
    '<button class="pm-btn pm-btn--buy" onclick="addToCart(true)"><i class="fas fa-bolt"></i> Buy Now</button>' +
    '</div></div></div></div>' +

    // Checkout overlay + modal
    '<div id="sn-coOverlay" class="sn-overlay" onclick="closeCheckout()"></div>' +
    '<div id="sn-checkoutModal" class="sn-checkout-modal"></div>' +

    // Success overlay + modal
    '<div id="sn-successOverlay" class="sn-overlay"></div>' +
    '<div id="sn-successModal" class="sn-success-modal">' +
    '<div class="success-icon"><i class="fas fa-check-circle"></i></div>' +
    '<h2>Order Placed!</h2>' +
    '<p>Thank you for shopping with HomeWeb.</p>' +
    '<p class="order-id-label">Order ID: <strong id="sn-orderId"></strong></p>' +
    '<div class="success-sub">You\'ll receive a confirmation SMS shortly.</div>' +
    '<div class="success-btns">' +
    '<button class="co-btn co-btn--next" onclick="closeSuccess(); openOrderTracking();">Track My Order</button>' +
    '<button class="co-btn co-btn--back" onclick="closeSuccess()">Continue Shopping <i class="fas fa-arrow-right"></i></button>' +
    '</div>' +
    '</div>' +

    // Tracking overlay + modal
    '<div id="sn-trackingOverlay" class="sn-overlay" onclick="closeOrderTracking()"></div>' +
    '<div id="sn-trackingModal" class="sn-tracking-modal">' +
    '<div class="track-header">' +
    '<h2>My Orders</h2>' +
    '<button class="co-close" onclick="closeOrderTracking()"><i class="fas fa-times"></i></button>' +
    '</div>' +
    '<div class="track-body">' +
    '<div id="sn-tracking-list"></div>' +
    '<div id="sn-tracking-detail" style="display:none"></div>' +
    '</div>' +
    '</div>' +
    // Login overlay + modal
    '<div id="sn-loginOverlay" class="sn-overlay" onclick="closeLoginModal()"></div>' +
    '<div id="sn-loginModal" class="sn-login-modal">' +
    '<button class="pm-close" onclick="closeLoginModal()"><i class="fas fa-times"></i></button>' +
    '<div class="login-body">' +
    '<div class="login-icon"><i class="fas fa-user-circle"></i></div>' +
    '<h2>Welcome Back</h2>' +
    '<p class="login-sub">Log in to your HomeWeb account</p>' +
    '<div class="co-field"><label>Email <span class="co-required">*</span></label>' +
    '<input type="email" id="login-email" placeholder="you@example.com"/>' +
    '<span class="co-field-error">Enter a valid email address</span></div>' +
    '<div class="co-field"><label>Password <span class="co-required">*</span></label>' +
    '<input type="password" id="login-password" placeholder="Enter your password"/>' +
    '<span class="co-field-error">Password is required</span></div>' +
    '<label class="login-remember"><input type="checkbox" id="login-remember"/> <span>Remember me</span></label>' +
    '<button class="co-btn co-btn--next login-submit" onclick="submitLogin()">Log In <i class="fas fa-arrow-right"></i></button>' +
    '<p class="login-signup">Don\'t have an account? <a href="#" onclick="closeLoginModal(); openSignupModal(event); return false;">Sign Up</a></p>' +
    '</div></div>' +

    // Signup overlay + modal
    '<div id="sn-signupOverlay" class="sn-overlay" onclick="closeSignupModal()"></div>' +
    '<div id="sn-signupModal" class="sn-login-modal">' +
    '<button class="pm-close" onclick="closeSignupModal()"><i class="fas fa-times"></i></button>' +
    '<div class="login-body">' +
    '<div class="login-icon"><i class="fas fa-user-plus"></i></div>' +
    '<h2>Create Your Account</h2>' +
    '<p class="login-sub">Sign up to start shopping on HomeWeb</p>' +
    '<div class="co-field"><label>Full Name <span class="co-required">*</span></label>' +
    '<input type="text" id="signup-name" placeholder="Juan Dela Cruz"/>' +
    '<span class="co-field-error">Full name is required</span></div>' +
    '<div class="co-field"><label>Email <span class="co-required">*</span></label>' +
    '<input type="email" id="signup-email" placeholder="you@example.com"/>' +
    '<span class="co-field-error">Enter a valid email address</span></div>' +
    '<div class="co-field"><label>Password <span class="co-required">*</span></label>' +
    '<input type="password" id="signup-password" placeholder="At least 6 characters"/>' +
    '<span class="co-field-error">Password must be at least 6 characters</span></div>' +
    '<div class="co-field"><label>Confirm Password <span class="co-required">*</span></label>' +
    '<input type="password" id="signup-password2" placeholder="Re-enter your password"/>' +
    '<span class="co-field-error">Passwords do not match</span></div>' +
    '<button class="co-btn co-btn--next login-submit" id="signup-submit-btn" onclick="submitSignup()">Sign Up <i class="fas fa-arrow-right"></i></button>' +
    '<p class="login-signup">Already have an account? <a href="#" onclick="closeSignupModal(); openLoginModal(event); return false;">Log In</a></p>' +
    '</div></div>';

  var div = document.createElement('div');
  div.innerHTML = html;
  while (div.firstChild) document.body.appendChild(div.firstChild);
}

// CART ICON CLICK //
function initCartClick() {
  document.querySelectorAll('.cart-icon').forEach(function(el) {
    el.addEventListener('click', function(e) {
      e.preventDefault();
      openCheckout();
    });
  });
}

// INIT //
document.addEventListener('DOMContentLoaded', function() {
  injectModals();
  injectProductIds();
  attachCardClicks();
  initCartClick();
  initLoginModal();
  updateCartBadge();
  initSearch();
  restoreSession();
});