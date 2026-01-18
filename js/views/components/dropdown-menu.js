// views/components/dropdown-menu.js

export function createDropdownMenu({ items }) {
    let isOpen = false;
    let root = null;
    let trigger = null;

    function createMenu() {
        root = document.createElement("div");
        root.className = "dropdown-menu hidden";

        items.forEach((item) => {
            const button = document.createElement("button");
            button.className = "dropdown-menu__item";
            button.type = "button";
            button.textContent = item.label;

            button.addEventListener("click", () => {
                item.onSelect();
                close();
            });

            root.appendChild(button);
        });

        document.body.appendChild(root);
    }

    function attachTo(element) {
        trigger = element;

        if (!root) {
            createMenu();
        }

        trigger.addEventListener("click", toggle);
        document.addEventListener("click", handleOutsideClick);
    }

    function toggle(event) {
        event.stopPropagation();
        isOpen ? close() : open();
    }

    function open() {
        if (!trigger) return;
    
        const rect = trigger.getBoundingClientRect();
    
        root.style.top = `${rect.top + window.scrollY}px`;
        root.style.left = `${rect.left + window.scrollX}px`;
    
        root.classList.remove("hidden");
        trigger.classList.add("icon-btn--active");
        isOpen = true;
    }
    
    
    
    function close() {
        if (!root) return;
    
        root.classList.add("hidden");
        trigger.classList.remove("icon-btn--active");
        isOpen = false;
    }
    

    function handleOutsideClick(event) {
        if (!root || root.contains(event.target) || trigger.contains(event.target)) {
            return;
        }
        close();
    }

    function dispose() {
        trigger?.removeEventListener("click", toggle);
        document.removeEventListener("click", handleOutsideClick);
        root?.remove();
    }

    return {
        attachTo,
        close,
        dispose,
    };
}
