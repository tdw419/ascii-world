// plugins/contact-form/index.js
// Contact Form Plugin — form fields with validation and storage
// Part of CMS Phase 4.2 — Built-in Plugins

import { Plugin } from '../../sync/plugin-api.js';

/**
 * ContactFormPlugin renders form fields (name, email, message) with
 * tab navigation between fields, enter to submit, input validation,
 * and stores submissions.
 *
 * Region: body
 */
export default class ContactFormPlugin extends Plugin {
    constructor(manifest) {
        super(manifest);
        this.fields = [
            { name: 'name', label: 'Name', value: '', error: '' },
            { name: 'email', label: 'Email', value: '', error: '' },
            { name: 'message', label: 'Message', value: '', error: '' },
        ];
        this.activeField = 0; // index of focused field
        this.cursorPos = 0; // cursor within active field
        this.submitted = false;
        this.submitError = null;
        this.submissions = [];
        this._buffer = [];
        this._storagePath = null;
    }

    onLoad(context) {
        super.onLoad(context);
        // Set storage path relative to data dir
        this._storagePath = 'contact-submissions.json';
    }

    registerRegions(layoutEngine) {
        return super.registerRegions(layoutEngine);
    }

    /**
     * Get the active field index.
     * @returns {number}
     */
    getActiveField() {
        return this.activeField;
    }

    /**
     * Get all field values.
     * @returns {Object}
     */
    getValues() {
        const values = {};
        for (const field of this.fields) {
            values[field.name] = field.value;
        }
        return values;
    }

    /**
     * Get all errors.
     * @returns {Object}
     */
    getErrors() {
        const errors = {};
        for (const field of this.fields) {
            errors[field.name] = field.error;
        }
        return errors;
    }

    /**
     * Get the list of submissions.
     * @returns {Array}
     */
    getSubmissions() {
        return [...this.submissions];
    }

    /**
     * Is the form submitted?
     * @returns {boolean}
     */
    isSubmitted() {
        return this.submitted;
    }

    /**
     * Set a field value directly (for testing).
     * @param {string} fieldName
     * @param {string} value
     */
    setFieldValue(fieldName, value) {
        const field = this.fields.find(f => f.name === fieldName);
        if (field) {
            field.value = value;
            field.error = '';
        }
    }

    /**
     * Validate all fields.
     * @returns {boolean} true if all valid
     */
    validate() {
        let valid = true;

        // Name validation
        const nameField = this.fields.find(f => f.name === 'name');
        if (!nameField.value || nameField.value.trim().length === 0) {
            nameField.error = 'Name is required';
            valid = false;
        } else if (nameField.value.trim().length < 2) {
            nameField.error = 'Name must be at least 2 characters';
            valid = false;
        } else {
            nameField.error = '';
        }

        // Email validation
        const emailField = this.fields.find(f => f.name === 'email');
        if (!emailField.value || emailField.value.trim().length === 0) {
            emailField.error = 'Email is required';
            valid = false;
        } else if (!this._isValidEmail(emailField.value)) {
            emailField.error = 'Invalid email format';
            valid = false;
        } else {
            emailField.error = '';
        }

        // Message validation
        const messageField = this.fields.find(f => f.name === 'message');
        if (!messageField.value || messageField.value.trim().length === 0) {
            messageField.error = 'Message is required';
            valid = false;
        } else if (messageField.value.trim().length < 10) {
            messageField.error = 'Message must be at least 10 characters';
            valid = false;
        } else {
            messageField.error = '';
        }

        return valid;
    }

    /**
     * Simple email format validation.
     * @param {string} email
     * @returns {boolean}
     */
    _isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    /**
     * Submit the form.
     * @returns {boolean} true if submission successful
     */
    submit() {
        this.submitError = null;

        if (!this.validate()) {
            return false;
        }

        const submission = {
            name: this.fields.find(f => f.name === 'name').value.trim(),
            email: this.fields.find(f => f.name === 'email').value.trim(),
            message: this.fields.find(f => f.name === 'message').value.trim(),
            timestamp: Date.now(),
        };

        this.submissions.push(submission);

        // Store in content store if available
        if (this.context && this.context.contentStore) {
            this.context.contentStore.create({
                type: 'post',
                title: `Contact: ${submission.name}`,
                body: submission.message,
                metadata: {
                    email: submission.email,
                    type: 'contact-submission',
                    timestamp: submission.timestamp,
                },
            });
        }

        // Reset form
        for (const field of this.fields) {
            field.value = '';
            field.error = '';
        }
        this.activeField = 0;
        this.cursorPos = 0;
        this.submitted = true;

        return true;
    }

    /**
     * Reset the form state.
     */
    reset() {
        for (const field of this.fields) {
            field.value = '';
            field.error = '';
        }
        this.activeField = 0;
        this.cursorPos = 0;
        this.submitted = false;
        this.submitError = null;
    }

    /**
     * Render the contact form.
     * @param {Object} screenManager
     * @param {string} region
     */
    render(screenManager, region) {
        if (region !== 'body') return;

        this._buffer = [];

        this._buffer.push('=== Contact Form ===');
        this._buffer.push('');

        for (let i = 0; i < this.fields.length; i++) {
            const field = this.fields[i];
            const isActive = i === this.activeField;
            const prefix = isActive ? ' > ' : '   ';

            // Field label
            this._buffer.push(`${prefix}${field.label}:`);

            // Field value with cursor
            const valueDisplay = isActive
                ? field.value.slice(0, this.cursorPos) + '│' + field.value.slice(this.cursorPos)
                : field.value;
            this._buffer.push(`   [${valueDisplay}]`);

            // Error message
            if (field.error) {
                this._buffer.push(`   ! ${field.error}`);
            }

            this._buffer.push('');
        }

        // Instructions
        if (this.submitted) {
            this._buffer.push('   Message sent successfully!');
        } else {
            this._buffer.push('   [Tab] Next field  [Enter] Submit  [Esc] Reset');
        }

        // Write to screen
        if (screenManager && typeof screenManager.writeAt === 'function') {
            for (let y = 0; y < this._buffer.length; y++) {
                screenManager.writeAt(0, y, this._buffer[y]);
            }
        }
    }

    /**
     * Get the rendered buffer.
     * @returns {string[]}
     */
    getBuffer() {
        return [...this._buffer];
    }

    /**
     * Handle keyboard input.
     * @param {Object} keyEvent
     * @param {string} focusedRegion
     * @returns {boolean}
     */
    handleInput(keyEvent, focusedRegion) {
        if (focusedRegion !== 'body') return false;

        const key = keyEvent.key || keyEvent.name || '';
        const field = this.fields[this.activeField];

        if (key === 'tab' || key === 'Tab') {
            // Move to next field
            this.activeField = (this.activeField + 1) % this.fields.length;
            this.cursorPos = this.fields[this.activeField].value.length;
            return true;
        }

        if (key === 'escape' || key === 'Escape') {
            this.reset();
            return true;
        }

        if (key === 'enter' || key === 'Return') {
            // If on last field or explicitly submitting
            if (this.activeField === this.fields.length - 1) {
                return this.submit();
            }
            // Move to next field
            this.activeField = (this.activeField + 1) % this.fields.length;
            this.cursorPos = this.fields[this.activeField].value.length;
            return true;
        }

        if (key === 'backspace' || key === 'Backspace') {
            if (this.cursorPos > 0) {
                field.value = field.value.slice(0, this.cursorPos - 1) + field.value.slice(this.cursorPos);
                this.cursorPos--;
                field.error = '';
            }
            return true;
        }

        if (key === 'delete' || key === 'Delete') {
            if (this.cursorPos < field.value.length) {
                field.value = field.value.slice(0, this.cursorPos) + field.value.slice(this.cursorPos + 1);
                field.error = '';
            }
            return true;
        }

        if (key === 'left' || key === 'ArrowLeft') {
            if (this.cursorPos > 0) this.cursorPos--;
            return true;
        }

        if (key === 'right' || key === 'ArrowRight') {
            if (this.cursorPos < field.value.length) this.cursorPos++;
            return true;
        }

        // Regular character input
        if (key.length === 1 && !keyEvent.ctrl && !keyEvent.meta) {
            field.value = field.value.slice(0, this.cursorPos) + key + field.value.slice(this.cursorPos);
            this.cursorPos++;
            field.error = '';
            return true;
        }

        return false;
    }

    onUnload() {
        this.fields = [];
        this._buffer = [];
        this.submissions = [];
        super.onUnload();
    }
}
