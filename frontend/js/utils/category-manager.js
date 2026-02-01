import { API_BASE, AUTH_KEYS } from "../data/storage.js";

/**
 * Manages category autocomplete functionality with frequency tracking
 */
export class CategoryManager {
  constructor(inputElement, dropdownElement, onSelect) {
    this.input = inputElement;
    this.dropdown = dropdownElement;
    this.onSelect = onSelect;
    this.categories = new Map(); // category -> usage count
    this.selectedIndex = -1;

    this.init();
  }

  init() {
    // Input events
    this.input.addEventListener("input", () => this.handleInput());
    this.input.addEventListener("focus", () => this.handleInput());
    this.input.addEventListener("keydown", (e) => this.handleKeydown(e));

    // Close dropdown when clicking outside
    document.addEventListener("click", (e) => {
      if (!this.input.contains(e.target) && !this.dropdown.contains(e.target)) {
        this.hideDropdown();
      }
    });
  }

  /**
   * Load categories from prime items and count frequencies
   */
  async loadCategories() {
    try {
      const response = await fetch(`${API_BASE}/prime-items/categories/`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem(AUTH_KEYS.access)}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) throw new Error("Failed to fetch categories");

      const categories = await response.json();

      // Clear and populate the map
      this.categories.clear();
      categories.forEach((cat) => {
        this.categories.set(cat.category, cat.count);
      });
    } catch (error) {
      console.error("Error loading categories:", error);
    }
  }

  /**
   * Get categories sorted by frequency (most used first), then filtered by search
   */
  getFilteredCategories(searchTerm = "") {
    const normalized = searchTerm.toLowerCase().trim();

    // Convert to array and sort by frequency
    let categories = Array.from(this.categories.entries()).sort(
      (a, b) => b[1] - a[1]
    ); // Sort by count descending

    // Filter by search term if provided
    if (normalized) {
      categories = categories.filter(([category]) =>
        category.toLowerCase().includes(normalized)
      );
    }

    return categories;
  }

  /**
   * Handle input changes - update dropdown
   */
  handleInput() {
    const searchTerm = this.input.value;
    this.selectedIndex = -1;
    this.renderDropdown(searchTerm);
  }

  /**
   * Handle keyboard navigation
   */
  handleKeydown(e) {
    const items = this.dropdown.querySelectorAll(".category-dropdown-item");

    if (e.key === "ArrowDown") {
      e.preventDefault();
      this.selectedIndex = Math.min(this.selectedIndex + 1, items.length - 1);
      this.updateSelection(items);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      this.selectedIndex = Math.max(this.selectedIndex - 1, -1);
      this.updateSelection(items);
    } else if (e.key === "Enter" && this.selectedIndex >= 0) {
      e.preventDefault();
      const selectedItem = items[this.selectedIndex];
      if (selectedItem) {
        const category = selectedItem.dataset.category;
        this.selectCategory(category);
      }
    } else if (e.key === "Escape") {
      this.hideDropdown();
    }
  }

  /**
   * Update visual selection in dropdown
   */
  updateSelection(items) {
    items.forEach((item, index) => {
      if (index === this.selectedIndex) {
        item.classList.add("category-dropdown-item--selected");
        item.scrollIntoView({ block: "nearest" });
      } else {
        item.classList.remove("category-dropdown-item--selected");
      }
    });
  }

  /**
   * Render the dropdown with filtered categories
   */
  renderDropdown(searchTerm = "") {
    const filtered = this.getFilteredCategories(searchTerm);

    if (filtered.length === 0) {
      this.hideDropdown();
      return;
    }

    const html = filtered
      .map(
        ([category, count]) => `
      <div class="category-dropdown-item" data-category="${this.escapeHtml(
        category
      )}">
        <span>${this.escapeHtml(this.capitalize(category))}</span>
        <span class="category-count">${count}</span>
      </div>
    `
      )
      .join("");

    this.dropdown.innerHTML = html;
    this.dropdown.classList.remove("hidden");

    // Attach click handlers
    this.dropdown
      .querySelectorAll(".category-dropdown-item")
      .forEach((item) => {
        item.addEventListener("click", () => {
          const category = item.dataset.category;
          this.selectCategory(category);
        });
      });
  }

  /**
   * Select a category
   */
  selectCategory(category) {
    this.input.value = category;
    this.hideDropdown();
    if (this.onSelect) {
      this.onSelect(category);
    }
  }

  /**
   * Hide the dropdown
   */
  hideDropdown() {
    this.dropdown.classList.add("hidden");
    this.selectedIndex = -1;
  }

  /**
   * Increment usage count for a category
   */
  incrementCategory(category) {
    if (!category || !category.trim()) return;

    const normalized = category.trim();
    const count = this.categories.get(normalized) || 0;
    this.categories.set(normalized, count + 1);
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Capitalize first letter of a string
   */
  capitalize(text) {
    if (!text) return "";
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  /**
   * Cleanup event listeners
   */
  dispose() {
    // Remove event listeners if needed
  }
}
