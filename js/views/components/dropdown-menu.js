// views/components/dropdown-menu.js

let openMenu = null;

function setOpenMenu(menu) {
    if (openMenu && openMenu !== menu) { 
        openMenu.close();}
    openMenu = menu;
}

export function createDropdownMenu({ items }) {
    let isOpen = false;
    let root = null;
    let trigger = null;

    const api = {
        attachTo,
        close,
        dispose,
    };

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
        if (!trigger || !root) return;
        setOpenMenu(api);
        const rect = trigger.getBoundingClientRect();
    
        // Temporarily show to measure width
        root.classList.remove("hidden");
        root.style.visibility = "hidden";
    
        const menuWidth = root.offsetWidth;
    
        root.style.top = `${rect.bottom + window.scrollY}px`;
        root.style.left = `${rect.right + window.scrollX - menuWidth}px`;
    
        root.style.visibility = "";
        trigger.classList.add("icon-btn--active");
        isOpen = true;
    }
    
    
    
    function close() {
        if (!root) return;
    
        root.classList.add("hidden");
        trigger.classList.remove("icon-btn--active");
        isOpen = false;

        if (openMenu === api) {
            openMenu = null;
        }
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

        if (openMenu === api) {
            openMenu = null;
        }
    }

    return api;
}
