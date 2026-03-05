/**
 * Generic category filter modal that can be used for any feature
 * @param {Object} options
 * @param {Function} options.onFilter - Callback when category is selected
 * @param {string} options.title - Modal title (default: "Filter by Category")
 */
export function createCategoryFilterModal({
  onFilter,
  title = "Filter by Category",
} = {}) {
  let root = null;
  let backdrop = null;
  let headingEl = null;
  let categoryListEl = null;
  let searchInputEl = null;
  let currentFilter = "";
  let allCategories = [];

  function ensureCreated() {
    if (root) return;

    backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop hidden";

    root = document.createElement("div");
    root.className = "modal modal--page modal--top hidden";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-labelledby", "category-filter-modal-title");

    root.innerHTML = `
        <div class="modal-content">
          <h2 id="category-filter-modal-title">${escapeHtml(title)}</h2>

          <input
            type="text"
            class="category-filter-search"
            data-search
            placeholder="Search categories..."
            autocomplete="off"
          />
          
          <div class="category-filter-list" data-category-list>
            <!-- Categories will be populated here -->
          </div>
  
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" data-cancel>
              Cancel
            </button>
          </div>
        </div>
      `;

    document.body.appendChild(backdrop);
    document.body.appendChild(root);

    headingEl = root.querySelector("#category-filter-modal-title");
    categoryListEl = root.querySelector("[data-category-list]");
    searchInputEl = root.querySelector("[data-search]");
    const cancelBtn = root.querySelector("[data-cancel]");

    if (!headingEl || !categoryListEl || !cancelBtn) {
      throw new Error("CategoryFilterModal: expected elements not found.");
    }

    searchInputEl.addEventListener("input", () => {
      const q = searchInputEl.value.trim().toLowerCase();
      const filtered = q
        ? allCategories.filter((c) => c.category.toLowerCase().includes(q))
        : allCategories;
      renderCategoryButtons(filtered, currentFilter);
    });

    cancelBtn.addEventListener("click", close);
    backdrop.addEventListener("click", close);
    document.addEventListener("keydown", handleEscape);
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  function renderCategoryButtons(categories, activeFilter = "") {
    if (!categoryListEl) return;

    const allButton = `
        <button class="category-filter-option ${!activeFilter ? "active" : ""}" 
                data-category="">
          <span class="category-name">All Items</span>
        </button>
      `;

    const categoryButtons = categories
      .map(
        (cat) => `
        <button class="category-filter-option ${
          activeFilter === cat.category ? "active" : ""
        }" 
                data-category="${escapeHtml(cat.category)}">
          <span class="category-name">${escapeHtml(cat.category)}</span>
          <span class="category-count">${cat.count}</span>
        </button>
      `
      )
      .join("");

    categoryListEl.innerHTML = allButton + categoryButtons;

    categoryListEl
      .querySelectorAll(".category-filter-option")
      .forEach((btn) => {
        btn.addEventListener("click", () => {
          handleFilterSelect(btn.dataset.category);
        });
      });
  }

  function populateCategories(categories, activeFilter = "") {
    allCategories = categories;
    if (searchInputEl) searchInputEl.value = "";
    renderCategoryButtons(categories, activeFilter);
  }

  function handleFilterSelect(category) {
    currentFilter = category;

    if (typeof onFilter === "function") {
      onFilter(category);
    }

    close();
  }

  async function open(categories, activeFilter = "") {
    ensureCreated();
    currentFilter = activeFilter;
    populateCategories(categories, activeFilter);
    openBase();
    setTimeout(() => searchInputEl?.focus(), 50);
  }

  function openBase() {
    if (!root || !backdrop) return;

    backdrop.classList.remove("hidden");
    root.classList.remove("hidden");
    document.body.classList.add("modal-open");
  }

  function close() {
    if (!backdrop || !root) return;

    backdrop.classList.add("hidden");
    root.classList.add("hidden");
    document.body.classList.remove("modal-open");
  }

  function handleEscape(event) {
    if (event.key === "Escape") close();
  }

  function dispose() {
    document.removeEventListener("keydown", handleEscape);

    if (backdrop) backdrop.remove();
    if (root) root.remove();

    backdrop = null;
    root = null;
    headingEl = null;
    categoryListEl = null;
    searchInputEl = null;
    allCategories = [];
    currentFilter = "";
  }

  return {
    open,
    close,
    dispose,
  };
}
