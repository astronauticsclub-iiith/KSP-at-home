// ── UI Component Factory ──────────────────────────────────────────────────────
// Reusable components for the SpaceX-inspired control interface.
// Styled via class names defined in styles.css.

/**
 * Creates a styled slider field with label, description, range input, and numeric readout.
 * @param {Object} opts
 * @param {string} opts.id - Unique identifier for the slider input
 * @param {string} opts.label - Display name for the parameter
 * @param {string} opts.description - Plain-language explanation of the parameter
 * @param {number} opts.min - Minimum slider value
 * @param {number} opts.max - Maximum slider value
 * @param {number} opts.step - Step increment
 * @param {number} opts.value - Initial value
 * @param {string} opts.unit - Unit suffix for the readout (e.g. 'kg', 'm/s')
 * @returns {HTMLElement} Container element with the complete slider field
 */
export function createSlider({ id, label, description, min, max, step, value, unit }) {
    const container = document.createElement('div');
    container.className = 'slider-field';

    // Label
    const labelEl = document.createElement('label');
    labelEl.className = 'slider-label';
    labelEl.setAttribute('for', id);
    labelEl.textContent = label;

    // Description tooltip
    const descEl = document.createElement('span');
    descEl.className = 'slider-description';
    descEl.textContent = description;

    // Range input
    const input = document.createElement('input');
    input.type = 'range';
    input.id = id;
    input.name = id;
    input.className = 'slider-input';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);

    // Bounds display
    const bounds = document.createElement('div');
    bounds.className = 'slider-bounds';

    const minSpan = document.createElement('span');
    minSpan.className = 'slider-bound-min';
    minSpan.textContent = String(min);

    const maxSpan = document.createElement('span');
    maxSpan.className = 'slider-bound-max';
    maxSpan.textContent = String(max);

    bounds.appendChild(minSpan);
    bounds.appendChild(maxSpan);

    // Numeric readout
    const readout = document.createElement('span');
    readout.className = 'slider-readout';
    readout.textContent = `${value}${unit ? ' ' + unit : ''}`;

    // Update readout on input
    input.addEventListener('input', () => {
        readout.textContent = `${input.value}${unit ? ' ' + unit : ''}`;
    });

    // Assemble
    container.appendChild(labelEl);
    container.appendChild(descEl);
    container.appendChild(input);
    container.appendChild(bounds);
    container.appendChild(readout);

    return container;
}

/**
 * Creates a styled button element.
 * @param {Object} opts
 * @param {string} opts.id - Unique identifier for the button
 * @param {string} opts.label - Button text (displayed uppercase)
 * @param {string} [opts.icon] - Optional icon text or symbol to prepend
 * @param {'primary'|'secondary'|'danger'} [opts.variant='secondary'] - Visual variant
 * @returns {HTMLButtonElement} Styled button element
 */
export function createButton({ id, label, icon, variant = 'secondary' }) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = id;
    btn.className = `ui-btn ui-btn--${variant}`;

    if (icon) {
        const iconSpan = document.createElement('span');
        iconSpan.className = 'ui-btn-icon';
        iconSpan.textContent = icon;
        btn.appendChild(iconSpan);
    }

    const labelSpan = document.createElement('span');
    labelSpan.className = 'ui-btn-label';
    labelSpan.textContent = label;
    btn.appendChild(labelSpan);

    return btn;
}
